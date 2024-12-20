import {DataConsumeListener} from "../../util/dataConsumeListener";

export class WriteUnit {
    buf: Buffer
    adr: string
    tag: Object
    listener: DataConsumeListener

    constructor(buf: Buffer, adr: string, tag: Object, lis: DataConsumeListener) {
        this.buf = buf
        this.adr = adr
        this.tag = tag
        this.listener = lis
    }

    done(): void {
        if (this.listener != null) {
            this.listener()
        }
    }
}