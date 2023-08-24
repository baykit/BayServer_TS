import {Command} from "bayserver-core/baykit/bayserver/protocol/command";
import {H2Packet} from "./h2Packet";
import {H2Flags} from "./h2Flags";
import {H2CommandHandler} from "./h2CommandHandler";

export abstract class H2Command extends Command<H2Command, H2Packet, H2CommandHandler> {

    flags: H2Flags
    streamId: number

    constructor(type: number, streamId: number, flags: H2Flags=null) {
        super(type);
        this.streamId = streamId
        if(flags == null)
            this.flags = new H2Flags()
        else
            this.flags = flags
    }

    unpack(pkt: H2Packet) {
        this.streamId = pkt.streamId
        this.flags = pkt.flags
    }

    pack(pkt: H2Packet) {
        pkt.streamId = this.streamId
        pkt.flags = this.flags
        pkt.packHeader()
    }
}