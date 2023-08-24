import {AjpCommand} from "../ajpCommand";
import {AjpAccessor, AjpPacket} from "../ajpPacket";
import {AjpType} from "../ajpType";
import {AjpCommandHandler} from "../ajpCommandHandler";

/**
 * Get Body Chunk format
 *
 * AJP13_GET_BODY_CHUNK :=
 *   prefix_code       6
 *   requested_length  (integer)
 */
export class CmdGetBodyChunk extends AjpCommand {

    reqLen: number

    constructor() {
        super(AjpType.GET_BODY_CHUNK, false);
    }

    pack(pkt: AjpPacket) : void {
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.putByte(this.type);
        acc.putShort(this.reqLen);

        // must be called from last line
        super.pack(pkt);
    }

    handle(handler: AjpCommandHandler): number {
        return handler.handleGetBodyChunk(this);
    }

}