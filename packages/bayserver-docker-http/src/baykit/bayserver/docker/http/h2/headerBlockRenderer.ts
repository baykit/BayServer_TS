import {SimpleBuffer} from "bayserver-core/baykit/bayserver/util/simpleBuffer";
import {HeaderBlock} from "./headerBlock";
import {IOException} from "bayserver-core/baykit/bayserver/util/ioException";

/**
 * HPack
 *   https://datatracker.ietf.org/doc/html/rfc7541
 */
export class HeaderBlockRenderer {

    private readonly buf: SimpleBuffer

    constructor(buf: SimpleBuffer) {
        this.buf = buf
    }

    renderHeaderBlocks(headerBlocks: HeaderBlock[]): void {
        for(const blk of headerBlocks) {
            this.renderHeaderBlock(blk)
        }
    }

    private renderHeaderBlock(blk: HeaderBlock): void {
        switch(blk.op) {
            case HeaderBlock.INDEX: {
                this.putHPackInt(blk.index, 7, 1)
                break
            }
            case HeaderBlock.OVERLOAD_KNOWN_HEADER:
                throw new IOException()
            case HeaderBlock.NEW_HEADER:
                throw new IOException()
            case HeaderBlock.KNOWN_HEADER: {
                this.putHPackInt(blk.index, 4, 0)
                this.putHPackString(blk.value, false)
                break
            }
            case HeaderBlock.UNKNOWN_HEADER: {
                this.putByte(0)
                this.putHPackString(blk.name, false)
                this.putHPackString(blk.value, false)
                break
            }
            case HeaderBlock.UPDATE_DYNAMIC_TABLE_SIZE:
                throw new IOException()
        }
    }

    private putHPackInt(val: number, prefix: number, head: number): void {
        let maxVal = 0xFF >> (8 - prefix)
        let headVal = (head << prefix) & 0xFF
        if(val < maxVal) {
            this.putByte(val | headVal)
        }
        else {
            this.putByte(headVal | maxVal)
            this.putHPackIntRest(val - maxVal)
        }
    }

    private putHPackIntRest(val: number): void {
        while(true) {
            let data = val & 0x7F
            let nextVal = val >> 7
            if(nextVal == 0) {
                this.putByte(data)
                break
            }
            else {
                this.putByte(data | 0x80)
                val = nextVal
            }
        }
    }

    private putHPackString(value: string, huffman: boolean): void {
        if(huffman)
            throw new Error("huffman encoding not implemented")
        let bytes = Buffer.from(value)
        this.putHPackInt(bytes.length, 7, 0)
        this.putBytes(bytes)
    }

    private putByte(val: number): void {
        this.buf.putByte(val & 0xFF)
    }

    private putBytes(data: Buffer): void {
        this.buf.put(data)
    }
}
