import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {HeaderBlock} from "./headerBlock";
import {HTree} from "./huffman/hTree";

/**
 * HPack
 *   https://datatracker.ietf.org/doc/html/rfc7541
 */
export class HeaderBlockParser {

    private readonly buf: Buffer
    private readonly start: number
    private pos: number
    private readonly len: number

    constructor(buf: Buffer, start: number, len: number) {
        this.buf = buf
        this.start = start
        this.pos = 0
        this.len = len
    }

    parseHeaderBlocks(): HeaderBlock[] {
        let headerBlocks: HeaderBlock[] = []
        while(this.pos < this.len) {
            let blk = this.parseHeaderBlock()
            if(BayLog.isTrace())
                BayLog.trace("h2: header block read: " + blk)
            headerBlocks.push(blk)
        }
        return headerBlocks
    }

    private parseHeaderBlock(): HeaderBlock {
        let blk = new HeaderBlock()
        let index = this.getByte()
        let indexHeaderField = (index & 0x80) != 0
        if(indexHeaderField) {
            blk.op = HeaderBlock.INDEX
            blk.index = index & 0x7F
        }
        else {
            let updateIndex = (index & 0x40) != 0
            if(updateIndex) {
                index = index & 0x3F
                let overloadIndex = index != 0
                if(overloadIndex) {
                    if(index == 0x3F)
                        index = index + this.getHPackIntRest()
                    blk.op = HeaderBlock.OVERLOAD_KNOWN_HEADER
                    blk.index = index
                    blk.value = this.getHPackString()
                }
                else {
                    blk.op = HeaderBlock.NEW_HEADER
                    blk.name = this.getHPackString()
                    blk.value = this.getHPackString()
                }
            }
            else {
                let updateDynamicTableSize = (index & 0x20) != 0
                if(updateDynamicTableSize) {
                    let size = index & 0x1f
                    if(size == 0x1f)
                        size = size + this.getHPackIntRest()
                    blk.op = HeaderBlock.UPDATE_DYNAMIC_TABLE_SIZE
                    blk.size = size
                }
                else {
                    index = (index & 0xF)
                    if(index != 0) {
                        if(index == 0xF)
                            index = index + this.getHPackIntRest()
                        blk.op = HeaderBlock.KNOWN_HEADER
                        blk.index = index
                        blk.value = this.getHPackString()
                    }
                    else {
                        blk.op = HeaderBlock.UNKNOWN_HEADER
                        blk.name = this.getHPackString()
                        blk.value = this.getHPackString()
                    }
                }
            }
        }
        return blk
    }

    private getByte(): number {
        let b = this.buf[this.start + this.pos] & 0xFF
        this.pos++
        return b
    }

    private getBytes(len: number): Buffer {
        let out = Buffer.alloc(len)
        this.buf.copy(out, 0, this.start + this.pos, this.start + this.pos + len)
        this.pos += len
        return out
    }

    private getHPackIntRest(): number {
        let rest = 0
        for(let i = 0; ; i++) {
            let data = this.getByte()
            let cont = (data & 0x80) != 0
            data = data & 0x7F
            rest = rest + (data << (i * 7))
            if(!cont)
                break
        }
        return rest
    }

    private getHPackString(): string {
        let firstByte = this.getByte()
        let isHuffman = (firstByte & 0x80) != 0
        let len = firstByte & 0x7F
        if(len == 0x7F)
            len = len + this.getHPackIntRest()
        let data = this.getBytes(len)
        if(isHuffman) {
            return HTree.decode(data)
        }
        else {
            return data.toString()
        }
    }
}
