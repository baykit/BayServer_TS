import {H2Command} from "../h2Command";
import {Buffer} from "buffer";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";
import {H2CommandHandler} from "../h2CommandHandler";

/**
 * HTTP/2 Data payload format
 *
 * +---------------+
 * |Pad Length? (8)|
 * +---------------+-----------------------------------------------+
 * |                            Data (*)                         ...
 * +---------------------------------------------------------------+
 * |                           Padding (*)                       ...
 * +---------------------------------------------------------------+
 */

export class CmdData extends H2Command {

    /**
     * This class refers external byte array, so this IS NOT mutable
     */
    start: number
    length: number
    data: Buffer

    constructor(streamId: number, flags: H2Flags, data:Buffer = null, start: number = null, length: number = null) {
        super(H2Type.DATA, streamId, flags);
        this.data = data
        this.start = start
        this.length = length
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);
        this.data = pkt.buf
        this.start = pkt.headerLen
        this.length = pkt.dataLen()
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();
        if(this.flags.padded())
            throw new Error("Padding not supported");
        acc.putBytes(this.data, this.start, this.length);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleData(this);
    }

}