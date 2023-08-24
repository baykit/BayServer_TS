import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2DataAccessor, H2Packet} from "../h2Packet";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {HeaderBlock} from "../headerBlock";

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

    padLength: number
    excluded: boolean
    streamDependency: number
    weight: number

    headerBlocks: HeaderBlock[] = []

    constructor(streamId: number, flags: H2Flags=null) {
        super(H2Type.HEADERS, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);

        let acc = pkt.newH2DataAccessor();

        if(pkt.flags.padded())
            this.padLength = acc.getByte();
        if(pkt.flags.priority()) {
            let val = acc.getInt();
            this.excluded = H2Packet.extractFlag(val) == 1;
            this.streamDependency = H2Packet.extractInt31(val);
            this.weight = acc.getByte();
        }
        this.readHeaderBlock(acc, pkt.dataLen());
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newH2DataAccessor();

        if(this.flags.padded()) {
            acc.putByte(this.padLength);
        }
        if(this.flags.priority()) {
            acc.putInt(H2Packet.makeStreamDependency32(this.excluded, this.streamDependency));
            acc.putByte(this.weight);
        }
        this.writeHeaderBlock(acc);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleHeaders(this);
    }

    addHeaderBlock(blk: HeaderBlock) {
        this.headerBlocks.push(blk)
    }

    private readHeaderBlock(acc: H2DataAccessor, len: number) {
        while(acc.pos < len) {
            let blk = HeaderBlock.unpack(acc);
            if(BayLog.isTrace())
                BayLog.trace("h2: header block read: " + blk);
            this.headerBlocks.push(blk);
        }
    }

    private writeHeaderBlock(acc: H2DataAccessor) {
        for(const blk of this.headerBlocks) {
            HeaderBlock.pack(blk, acc);
        }
    }
}