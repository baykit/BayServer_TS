import {H1Command} from "../h1Command";
import {H1CommandHandler} from "../h1CommandHandler";
import {H1Packet} from "../h1Packet";
import {Buffer} from "buffer";
import {H1Type} from "../h1Type";

export class CmdContent extends H1Command {

    buffer: Buffer;
    start: number;
    len: number;

    constructor(buf: Buffer, start: number, len: number) {
        super(H1Type.CONTENT);
        this.buffer = buf;
        this.start = start;
        this.len = len;
    }

    handle(handler: H1CommandHandler): number {
        return handler.handleContent(this);
    }

    pack(pkt: H1Packet): void {
        let acc = pkt.newDataAccessor();
        acc.putBytes(this.buffer, this.start, this.len);
    }

    unpack(pkt: H1Packet): void {
        this.buffer = pkt.buf;
        this.start = pkt.headerLen;
        this.len = pkt.dataLen();
    }

}