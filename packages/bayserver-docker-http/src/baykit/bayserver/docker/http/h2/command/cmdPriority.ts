import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";


/**
 * HTTP/2 Priority payload format
 *
 * +-+-------------------------------------------------------------+
 * |E|                  Stream Dependency (31)                     |
 * +-+-------------+-----------------------------------------------+
 * |   Weight (8)  |
 * +-+-------------+
 *
 */
export class CmdPriority extends H2Command {

    weight: number
    excluded: boolean
    streamDependency: number

    constructor(streamId: number, flags: H2Flags) {
        super(H2Type.PRIORITY, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);
        let acc = pkt.newDataAccessor();

        let val = acc.getInt();
        this.excluded = H2Packet.extractFlag(val) == 1;
        this.streamDependency = H2Packet.extractInt31(val);

        this.weight = acc.getByte();
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();
        acc.putInt(H2Packet.makeStreamDependency32(this.excluded, this.streamDependency));
        acc.putByte(this.weight);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handlePriority(this);
    }

}