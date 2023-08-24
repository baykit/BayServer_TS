import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";

/**
 * HTTP/2 RstStream payload format
 *
 +---------------------------------------------------------------+
 |                        Error Code (32)                        |
 +---------------------------------------------------------------+
 *
 */
export class CmdRstStream extends H2Command {

    errorCode: number

    constructor(streamId: number, flags: H2Flags = null) {
        super(H2Type.RST_STREAM, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);
        let acc = pkt.newDataAccessor();
        this.errorCode = acc.getInt();
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();
        acc.putInt(this.errorCode);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleRstStream(this);
    }

}