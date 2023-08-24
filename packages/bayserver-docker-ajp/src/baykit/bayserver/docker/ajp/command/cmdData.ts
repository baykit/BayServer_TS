import {AjpCommand} from "../ajpCommand";
import {AjpAccessor, AjpPacket} from "../ajpPacket";
import {Buffer} from "buffer";
import {AjpType} from "../ajpType";
import {AjpCommandHandler} from "../ajpCommandHandler";

/**
 * Data command format
 *
 *   raw data
 */
export class CmdData extends AjpCommand {

    static readonly LENGTH_SIZE: number = 2;
    static readonly MAX_DATA_LEN: number = AjpPacket.MAX_DATA_LEN - this.LENGTH_SIZE;

    start: number
    length: number
    data: Buffer

    constructor(data: Buffer = null, start: number = null, length: number = null) {
        super(AjpType.DATA, true);
        this.start = start;
        this.length = length;
        this.data = data;
    }

    unpack(pkt: AjpPacket) : void {
        super.unpack(pkt);
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        this.length = acc.getShort();

        this.data = pkt.buf;
        this.start = pkt.headerLen + 2;
    }

    pack(pkt: AjpPacket) : void {
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.putShort(this.length);
        acc.putBytes(this.data, this.start, this.length);

        // must be called from last line
        super.pack(pkt);
    }

    handle(handler: AjpCommandHandler): number {
        return handler.handleData(this);
    }

}