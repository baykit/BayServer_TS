import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {H1Command} from "./h1Command";
import {H1Packet} from "./h1Packet";
import {H1CommandHandler} from "./h1CommandHandler";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {HtpDockerConst} from "../htpDockerConst";
import {H1CommandUnPacker} from "./h1CommandUnPacker";
import {H1PacketUnpacker} from "./h1PacketUnPacker";
import {CmdContent} from "./command/cmdContent";
import {CmdEndContent} from "./command/cmdEndContent";
import {CmdHeader} from "./command/cmdHeader";

export abstract class H1ProtocolHandler extends ProtocolHandler<H1Command, H1Packet> implements H1CommandHandler{

    keeping: boolean;

    protected constructor(
        pktStore: PacketStore<H1Packet>,
        svrMode: boolean) {
        super();
        this.commandUnpacker = new H1CommandUnPacker(this, svrMode);
        this.packetUnpacker = new H1PacketUnpacker(this.commandUnpacker as H1CommandUnPacker, pktStore);
        this.packetPacker = new PacketPacker();
        this.commandPacker = new CommandPacker(this.packetPacker, pktStore);
        this.serverMode = svrMode;
    }


    abstract handleContent(cmd: CmdContent): number;
    abstract handleEndContent(cmdEndContent: CmdEndContent): number;
    abstract handleHeader(cmd: CmdHeader): number;
    abstract reqFinished(): boolean;


    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
        super.reset();
        this.keeping = false;
    }

    //////////////////////////////////////////////////////
    // Implements ProtocolHandler
    //////////////////////////////////////////////////////

    protocol(): string {
        return HtpDockerConst.H1_PROTO_NAME;
    }

    maxReqPacketDataSize(): number {
        return H1Packet.MAX_DATA_LEN;
    }

    public maxResPacketDataSize(): number {
        return H1Packet.MAX_DATA_LEN;
    }


}