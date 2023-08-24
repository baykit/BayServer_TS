import {H2Command} from "../h2Command";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";
import {H2CommandHandler} from "../h2CommandHandler";

/**
 * HTTP/2 GoAway payload format
 *
 * +-+-------------------------------------------------------------+
 * |R|                  Last-Stream-ID (31)                        |
 * +-+-------------------------------------------------------------+
 * |                      Error Code (32)                          |
 * +---------------------------------------------------------------+
 * |                  Additional Debug Data (*)                    |
 * +---------------------------------------------------------------+
 *
 */
export class CmdGoAway extends H2Command {

    lastStreamId: number
    errorCode: number
    debugData: Buffer

    constructor(streamId: number, flags: H2Flags = null) {
        super(H2Type.GOAWAY, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);
        let acc = pkt.newDataAccessor();
        let val = acc.getInt();
        this.lastStreamId = H2Packet.extractInt31(val);
        this.errorCode = acc.getInt();
        this.debugData = Buffer.alloc(pkt.dataLen() - acc.pos);
        acc.getBytes(this.debugData, 0, this.debugData.length);
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();
        acc.putInt(this.lastStreamId);
        acc.putInt(this.errorCode);
        if(this.debugData != null)
            acc.putBytes(this.debugData, 0, this.debugData.length);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleGoAway(this);
    }

}