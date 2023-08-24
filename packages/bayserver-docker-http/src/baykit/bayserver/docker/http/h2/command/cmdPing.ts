import {H2Command} from "../h2Command";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";
import {H2CommandHandler} from "../h2CommandHandler";

export class CmdPing extends H2Command {

    opaqueData: Buffer

    constructor(streamId: number, flags: H2Flags, opaqueData: Buffer=null) {
        super(H2Type.PING, streamId, flags);
        this.opaqueData = Buffer.alloc(8)
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);
        let acc = pkt.newDataAccessor();
        acc.getBytes(this.opaqueData, 0, 8);
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();
        acc.putBytes(this.opaqueData);
        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handlePing(this);
    }

}