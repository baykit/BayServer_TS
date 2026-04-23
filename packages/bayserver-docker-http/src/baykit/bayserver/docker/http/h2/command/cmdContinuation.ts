import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";

/**
 * HTTP/2 Continuation payload format
 *
 * +---------------------------------------------------------------+
 * |                   Header Block Fragment (*)                 ...
 * +---------------------------------------------------------------+
 */
export class CmdContinuation extends H2Command {

    /** This class refers external byte array, so this IS NOT mutable */
    start: number
    length: number
    data: Buffer

    constructor(streamId: number, flags: H2Flags = null) {
        super(H2Type.CONTINUATION, streamId, flags);
    }

    unpack(pkt: H2Packet): void {
        super.unpack(pkt);
        this.data = pkt.buf;
        this.start = pkt.headerLen;
        this.length = pkt.dataLen();
    }

    pack(pkt: H2Packet): void {
        let acc = pkt.newDataAccessor();
        if(this.flags.padded())
            throw new Error("Padding not supported");
        acc.putBytes(this.data, this.start, this.length);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleContinuation(this);
    }
}
