import {AjpCommand} from "../ajpCommand";
import {AjpAccessor, AjpPacket} from "../ajpPacket";
import {AjpType} from "../ajpType";
import {AjpCommandHandler} from "../ajpCommandHandler";
import {Buffer} from "buffer";

/**
 * Send body chunk format
 *
 * AJP13_SEND_BODY_CHUNK :=
 *   prefix_code   3
 *   chunk_length  (integer)
 *   chunk        *(byte)
 */
export class CmdSendBodyChunk extends AjpCommand {

    chunk: Buffer
    offset: number
    length: number

    static readonly MAX_CHUNKLEN: number = AjpPacket.MAX_DATA_LEN - 4;

    constructor(buf: Buffer, ofs: number, len: number) {
        super(AjpType.SEND_BODY_CHUNK, false);
        this.chunk = buf;
        this.offset = ofs;
        this.length = len;
    }

    pack(pkt: AjpPacket) : void {
        if(this.length > CmdSendBodyChunk.MAX_CHUNKLEN)
            throw new Error("Illegal Argument");

        let acc = pkt.newAjpDataAccessor();

        acc.putByte(this.type);
        acc.putShort(this.length);
        acc.putBytes(this.chunk, this.offset, this.length);
        acc.putByte(0);   // maybe document bug

        // must be called from last line
        super.pack(pkt);
    }

    unpack(pkt: AjpPacket) : void {
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.getByte(); // code
        this.length = acc.getShort();
        if(this.chunk == null || this.length > this.chunk.length)
            this.chunk = Buffer.alloc(this.length)
        acc.getBytes(this.chunk, 0, this.length);
    }

    handle(handler: AjpCommandHandler): number {
        return handler.handleSendBodyChunk(this);
    }

}