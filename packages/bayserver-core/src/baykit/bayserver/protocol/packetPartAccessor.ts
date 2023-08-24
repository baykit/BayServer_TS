import {Packet} from "./packet";
import {Buffer} from "buffer";
import {Sink} from "../sink";

export class PacketPartAccessor {

    readonly packet: Packet
    readonly start: number;
    readonly maxLen: number;
    public pos: number;

    public constructor(pkt: Packet, start: number, maxLen: number) {
        this.packet = pkt;
        this.start = start;
        this.maxLen = maxLen;
        this.pos = 0;
    }

    public putByte(b: number): void {
        this.putBytes(Buffer.from([b]), 0, 1);
    }

    public putBytes(buf: Buffer, ofs: number=0, len: number=buf.length): void {
        if (len > 0) {
            this.checkWrite(len);
            while (this.start + this.pos + len > this.packet.buf.length) {
                this.packet.expand();
            }
            buf.copy(this.packet.buf, this.start + this.pos, ofs, ofs + len);
            this.forward(len);
        }
    }

    public putShort(val: number): void {
        let h: number = val >> 8 & 0xFF;
        let l: number = val & 0xFF;
        this.putBytes(Buffer.from([h, l]), 0, 2);
    }

    public putInt(val: number): void {
        let b1: number = val >> 24 & 0xFF;
        let b2: number = val >> 16 & 0xFF;
        let b3: number = val >> 8 & 0xFF;
        let b4 = val & 0xFF;
        this.putBytes(Buffer.from([b1, b2, b3, b4]), 0, 4);
    }

    public putString(s: string): void {
        if (s == null)
            throw new Error();
        let tmpBuf = Buffer.from(s, "latin1")
        this.putBytes(tmpBuf, 0, tmpBuf.length)
    }

    public getByte(): number {
        let buf = Buffer.alloc(1);
        this.getBytes(buf, 0, 1);
        return buf[0] & 0xFF;
    }

    public getBytes(buf: Buffer, ofs: number=0, len: number=buf.length): void {
        if (buf == null)
            throw new Error("nullPo");
        this.checkRead(len);
        this.packet.buf.copy(buf, ofs, this.start + this.pos, this.start + this.pos + len);
        this.pos += len;
    }

    public getShort(): number {
        let h: number = this.getByte();
        let l: number = this.getByte();
        return h << 8 | l;
    }

    public getInt(): number {
        let b1: number = this.getByte();
        let b2: number = this.getByte();
        let b3: number = this.getByte();
        let b4: number = this.getByte();
        return b1 << 24 | b2 << 16 | b3 << 8 | b4;
    }

    public checkRead(len: number): void {
        let maxLen = (this.maxLen >= 0) ? this.maxLen : this.packet.bufLen - this.start
        if (this.pos + len > maxLen)
            throw new Sink("Invalid index");
    }

    public checkWrite(len: number): void {
        if (this.maxLen > 0 && this.pos + len > this.maxLen)
            throw new Sink("Buffer overflow");
    }

    public forward(len: number) {
        this.pos += len;
        if (this.start + this.pos > this.packet.bufLen)
            this.packet.bufLen = this.start + this.pos;
    }
}