import {AjpCommand} from "../ajpCommand";
import {AjpAccessor, AjpPacket} from "../ajpPacket";
import {AjpType} from "../ajpType";
import {AjpCommandHandler} from "../ajpCommandHandler";

/**
 * End response body format
 *
 * AJP13_END_RESPONSE :=
 *   prefix_code       5
 *   reuse             (boolean)
 */
export class CmdEndResponse extends AjpCommand {

    reuse: boolean

    constructor() {
        super(AjpType.END_RESPONSE, false);
    }

    unpack(pkt: AjpPacket) : void {
        super.unpack(pkt);
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.getByte(); // prefix code
        this.reuse = acc.getByte() != 0;
    }

    pack(pkt: AjpPacket) : void {
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.putByte(this.type);
        acc.putByte(this.reuse ? 1 : 0);

        // must be called from last line
        super.pack(pkt);
    }

    handle(handler: AjpCommandHandler): number {
        return handler.handleEndResponse(this);
    }

}