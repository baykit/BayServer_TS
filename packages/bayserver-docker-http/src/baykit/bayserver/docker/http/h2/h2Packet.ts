import {Packet} from "bayserver-core/baykit/bayserver/protocol/packet";
import {PacketPartAccessor} from "bayserver-core/baykit/bayserver/protocol/packetPartAccessor";
import {Buffer} from "buffer";
import {H2Flags} from "./h2Flags";
import {HTree} from "./huffman/hTree";

/**
 * Http2 spec
 *   https://www.rfc-editor.org/rfc/rfc7540.txt
 *
 * Http2 Frame format
 * +-----------------------------------------------+
 * |                 Length (24)                   |
 * +---------------+---------------+---------------+
 * |   Type (8)    |   Flags (8)   |
 * +-+-+-----------+---------------+-------------------------------+
 * |R|                 Stream Identifier (31)                      |
 * +=+=============================================================+
 * |                   Frame Payload (0...)                      ...
 * +---------------------------------------------------------------+
 */

export class H2HeaderAccessor extends PacketPartAccessor {

    constructor(pkt: Packet, start: number, len: number) {
        super(pkt, start, len);
    }

    putInt24(len: number) {
        let b1 = (len >> 16) & 0xFF
        let b2 = (len >> 8) & 0xFF
        let b3 = len & 0xFF
        this.putBytes(Buffer.from([b1, b2, b3]), 0, 3);
    }
}

export class H2DataAccessor extends PacketPartAccessor {

    constructor(pkt: Packet, start: number, len: number) {
        super(pkt, start, len);
    }

    getHPackInt(prefix: number, head: number[]): number {
        let maxVal = 0xFF >> (8 - prefix);

        let firstByte = this.getByte();
        let firstVal = firstByte & maxVal;
        head[0] = firstByte >> prefix;
        if(firstVal != maxVal) {
            return firstVal;
        }
        else {
            return maxVal + this.getHPackIntRest();
        }
    }

    getHPackIntRest(): number {
        let rest = 0;
        for(let i = 0; ; i++) {
            let data = this.getByte();
            let cont = (data & 0x80) != 0;
            let value = (data & 0x7F);
            rest = rest + (value << (i * 7));
            if(!cont)
                break;
        }
        return rest;
    }

    getHPackString(): string {
        let isHuffman = [0];
        let len = this.getHPackInt(7, isHuffman);
        let data = Buffer.alloc(len);
        this.getBytes(data, 0, len);
        if(isHuffman[0] == 1) {
            // Huffman
            /*
            for(int i = 0; i < data.length; i++) {
                String bits = "00000000" + Integer.toString(data[i] & 0xFF, 2);
                BayServer.debug(bits.substring(bits.length() - 8));
            }
            */
            return HTree.decode(data);
        }
        else {
            // ASCII
            return data.toString()
        }
    }

    putHPackInt(val: number, prefix: number, head: number) {
        let maxVal = 0xFF >> (8 - prefix);
        let headVal = (head  << prefix) & 0xFF;
        if(val < maxVal) {
            this.putByte(val | headVal);
        }
        else {
            this.putByte(headVal | maxVal);
            this.putHPackIntRest(val - maxVal);
        }
    }

    putHPackIntRest(val: number) {
        while(true) {
            let data = val & 0x7F;
            let nextVal = val >> 7;
            if(nextVal == 0) {
                // data end
                this.putByte(data);
                break;
            }
            else {
                // data continues
                this.putByte(data | 0x80);
                val = nextVal;
            }
        }
    }

    putHPackString(value: string, haffman: boolean) {
        if(haffman) {
            throw new Error("Illegal Argument");
        }
        else {
            this.putHPackInt(value.length, 7, 0);
            this.putBytes(Buffer.from(value), 0, value.length);
        }
    }
}

export class H2Packet extends Packet {

    static readonly MAX_PAYLOAD_MAXLEN = 0x00FFFFFF; // = 2^24-1 = 16777215 = 16MB-1
    static readonly DEFAULT_PAYLOAD_MAXLEN = 0x00004000; // = 2^14 = 16384 = 16KB
    static readonly FRAME_HEADER_LEN = 9;

    static readonly NO_ERROR = 0x0;
    static readonly PROTOCOL_ERROR = 0x1;
    static readonly INTERNAL_ERROR = 0x2;
    static readonly FLOW_CONTROL_ERROR = 0x3;
    static readonly SETTINGS_TIMEOUT = 0x4;
    static readonly STREAM_CLOSED = 0x5;
    static readonly FRAME_SIZE_ERROR = 0x6;
    static readonly REFUSED_STREAM = 0x7;
    static readonly CANCEL = 0x8;
    static readonly COMPRESSION_ERROR = 0x9;
    static readonly CONNECT_ERROR = 0xa;
    static readonly ENHANCE_YOUR_CALM = 0xb;
    static readonly INADEQUATE_SECURITY = 0xc;
    static readonly HTTP_1_1_REQUIRED = 0xd;

    flags: H2Flags;
    streamId = -1;

    constructor(type: number) {
        super(type, H2Packet.FRAME_HEADER_LEN, H2Packet.DEFAULT_PAYLOAD_MAXLEN);
    }

    reset() {
        this.flags = new H2Flags();
        this.streamId = -1;
        super.reset();
    }

    toString(): string {
        return "H2Packet(" + this.type + ") hlen=" + this.headerLen + " dlen=" + this.dataLen() + " stm=" + this.streamId + " flg=" + this.flags;
    }

    packHeader() {
        let acc = this.newH2HeaderAccessor();
        acc.putInt24(this.dataLen());
        acc.putByte(this.type);
        acc.putByte(this.flags.flags);
        acc.putInt(H2Packet.extractInt31(this.streamId));
    }

    newH2HeaderAccessor(): H2HeaderAccessor {
        return new H2HeaderAccessor(this, 0, this.headerLen)
    }

    newH2DataAccessor(): H2DataAccessor {
        return new H2DataAccessor(this, this.headerLen, -1)
    }

    static extractInt31(val: number) {
        return val & 0x7FFFFFFF
    }

    static extractFlag(val: number) {
        return ((val & 0x80000000) >> 31) & 1
    }

    static consolidateFlagAndInt32(flag: number, val: number): number {
        return (flag & 1) << 31 | (val & 0x7FFFFFFF)
    }

    static makeStreamDependency32(excluded: boolean, dep: number) {
        return (excluded ? 1 : 0) << 31 | this.extractInt31(dep);
    }
}