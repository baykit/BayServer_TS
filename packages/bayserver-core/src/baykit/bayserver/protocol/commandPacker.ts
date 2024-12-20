import {Command} from "./command";
import {Packet} from "./packet";
import {CommandHandler} from "./commandHandler";
import {Reusable} from "../util/Reusable";
import {PacketPacker} from "./packetPacker";
import {PacketStore} from "./packetStore";
import {Ship} from "../ship/ship";
import {BayLog} from "../bayLog";
import {DataConsumeListener} from "../util/dataConsumeListener";

export class CommandPacker<C extends Command<C, P, H>, P extends Packet, H extends CommandHandler<C>>
    implements Reusable {

    protected readonly pktPacker: PacketPacker<P>;
    protected readonly pktStore: PacketStore<P> ;

    public constructor(pktPacker: PacketPacker<P> , pktStore: PacketStore<P> ) {
        this.pktPacker = pktPacker;
        this.pktStore = pktStore;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    public reset(): void {
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    public post(sip: Ship, cmd: C, listener: DataConsumeListener = null): void {
        let pkt: P  = this.pktStore.rent(cmd.type);

        try {
            cmd.pack(pkt);
            this.pktPacker.post(sip, pkt, () => {
                //BayLog.debug("%s callback & return packet", sip)
                this.pktStore.Return(pkt);
                if (listener != null)
                    listener();
                });
        }
        catch(e) {
            this.pktStore.Return(pkt);
            throw e;
        }
    }
}
