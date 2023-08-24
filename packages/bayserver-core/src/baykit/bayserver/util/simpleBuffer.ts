import {Buffer} from "buffer";
import {Reusable} from "./Reusable";

export class SimpleBuffer implements Reusable{
    static readonly INITIAL_BUFFER_SIZE: number = 32768;

    capacity: number;
    buf: Buffer;
    len: number = 0;

    constructor(init: number = SimpleBuffer.INITIAL_BUFFER_SIZE) {
        this.capacity = init;
        this.buf = Buffer.alloc(init)
    }

    //////////////////////////////////////////////////////
    // implements Reusable
    //////////////////////////////////////////////////////

    reset() {
        this.buf.fill(0)
        this.len = 0
    }


    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////
    bytes() : Buffer
    {
        return this.buf;
    }

    putByte(b: number) {
        this.put(Buffer.alloc(1, b), 0, 1);
    }

    put(buf: Buffer, pos: number = 0, len: number = null) {
        if (len == null)
            len = buf.length;

        while (this.len + len > this.buf.length) {
            this.extendBuf();
        }

        buf.copy(this.buf, this.len, pos, pos + len)

        this.len += len;
    }

    extendBuf() {
        let newBuf = Buffer.alloc(this.buf.length * 2)
        this.buf.copy(newBuf, 0, 0, this.len)
        this.buf = newBuf;
    }
}