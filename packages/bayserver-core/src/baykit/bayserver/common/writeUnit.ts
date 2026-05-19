import {DataConsumeListener} from "../util/dataConsumeListener";
import {Rudder} from "../rudder/rudder";

export class WriteUnit {
    buf: Buffer
    file: Rudder
    adr: string
    tag: Object
    listener: DataConsumeListener
    written: number = 0
    offset: number = 0
    length: number = 0

    constructor(buf: Buffer, adr: string, tag: Object, listener: DataConsumeListener);
    constructor(file: Rudder, ofs: number, len: number, listener: DataConsumeListener);
    constructor(
        a: Buffer | Rudder,
        b: string | number,
        c: Object | number,
        listener: DataConsumeListener) {
        if (Buffer.isBuffer(a)) {
            this.buf = a
            this.adr = b as string
            this.tag = c as Object
        }
        else {
            this.file = a as Rudder
            this.offset = b as number
            this.length = c as number
        }
        this.listener = listener
    }

    done(): void {
        if (this.listener != null) {
            this.listener()
        }
    }

    skipFormalities(): boolean {
        return this.file != null
    }

    position(): number {
        if (this.skipFormalities())
            return this.offset + this.written
        else
            return this.written
    }

    remaining(): number {
        if (this.skipFormalities())
            return this.length - this.written
        else
            return this.buf.length - this.written
    }

    forward(len: number): void {
        this.written += len
    }

    hasRemaining(): boolean {
        if (this.skipFormalities())
            return this.length > this.written
        else
            return this.buf.length > this.written
    }
}
