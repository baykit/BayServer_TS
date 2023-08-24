import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";

/**
 * HTTP/2 Window Update payload format
 *
 * +-+-------------------------------------------------------------+
 * |R|              Window Size Increment (31)                     |
 * +-+-------------------------------------------------------------+
 */
export class CmdWindowUpdate extends H2Command {

    windowSizeIncrement: number

    constructor(streamId: number, flags: H2Flags = null) {
        super(H2Type.WINDOW_UPDATE, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);
        let acc = pkt.newDataAccessor();
        let val = acc.getInt();
        this.windowSizeIncrement = H2Packet.extractInt31(val);
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();
        acc.putInt(H2Packet.consolidateFlagAndInt32(0, this.windowSizeIncrement));

        BayLog.debug("Pack windowUpdate size=" + this.windowSizeIncrement);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleWindowUpdate(this);
    }

}