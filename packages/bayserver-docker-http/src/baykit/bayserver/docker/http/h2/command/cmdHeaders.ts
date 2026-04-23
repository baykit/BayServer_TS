import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";

/**
 * HTTP/2 Header payload format
 *
 * +---------------+
 * |Pad Length? (8)|
 * +-+-------------+-----------------------------------------------+
 * |E|                 Stream Dependency? (31)                     |
 * +-+-------------+-----------------------------------------------+
 * |  Weight? (8)  |
 * +-+-------------+-----------------------------------------------+
 * |                   Header Block Fragment (*)                 ...
 * +---------------------------------------------------------------+
 * |                           Padding (*)                       ...
 * +---------------------------------------------------------------+
 */
export class CmdHeaders extends H2Command {

    /** This class refers external byte array, so this IS NOT mutable */
    start: number
    length: number
    data: Buffer

    padLength: number
    excluded: boolean
    streamDependency: number
    weight: number

    constructor(streamId: number, flags: H2Flags=null) {
        super(H2Type.HEADERS, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);

        let acc = pkt.newDataAccessor();

        if(pkt.flags.padded())
            this.padLength = acc.getByte();
        if(pkt.flags.priority()) {
            let val = acc.getInt();
            this.excluded = H2Packet.extractFlag(val) == 1;
            this.streamDependency = H2Packet.extractInt31(val);
            this.weight = acc.getByte();
        }
        this.data = pkt.buf;
        this.start = pkt.headerLen + acc.pos;
        this.length = pkt.dataLen() - acc.pos;
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();

        if(this.flags.padded()) {
            acc.putByte(this.padLength);
        }
        if(this.flags.priority()) {
            acc.putInt(H2Packet.makeStreamDependency32(this.excluded, this.streamDependency));
            acc.putByte(this.weight);
        }

        acc.putBytes(this.data, this.start, this.length);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleHeaders(this);
    }
}
