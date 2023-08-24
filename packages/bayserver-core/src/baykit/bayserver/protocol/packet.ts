import {Reusable} from "../util/Reusable";
import {Buffer} from "buffer";
import {PacketPartAccessor} from "./packetPartAccessor";

/**
 * Packet format
 *   +---------------------------+
 *   +  Header(type, length etc) +
 *   +---------------------------+
 *   +  Data(payload data)       +
 *   +---------------------------+
 */
export abstract class Packet implements Reusable {

    public static readonly INITIAL_BUF_SIZE: number = 8192 * 4;

    public readonly type: number;
    public buf: Buffer;
    public bufLen: number;
    public readonly headerLen: number;
    public readonly maxDataLen: number;

    public constructor(type: number, headerLen: number, maxDataLen: number) {
        this.type = type;
        this.headerLen = headerLen;
        this.maxDataLen = maxDataLen;
        this.buf = Buffer.alloc(Packet.INITIAL_BUF_SIZE)
        this.bufLen = headerLen;
    }

    public reset(): void {
        // Clear buffer for security
        this.buf.fill(0)
        this.bufLen = this.headerLen;
    }

    public dataLen(): number {
        return this.bufLen - this.headerLen;
    }

    public expand(): void {
        let newBuf = Buffer.alloc(this.buf.length * 2);
        this.buf.copy(newBuf, 0, 0)
        this.buf = newBuf
    }

    public newHeaderAccessor(): PacketPartAccessor {
        return new PacketPartAccessor(this, 0, this.headerLen);
    }

    public newDataAccessor(): PacketPartAccessor {
        return new PacketPartAccessor(this, this.headerLen, -1);
    }

    public toString(): string {
        return "Packet[" + this.type + "]";
    }
}