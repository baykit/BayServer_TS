import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {FcgCommand} from "./fcgCommand";
import {FcgPacket} from "./fcgPacket";
import {FcgCommandHandler} from "./fcgCommandHandler";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {FcgDockerConst} from "./fcgDockerConst";
import {FcgCommandUnPacker} from "./fcgCommandUnPacker";
import {FcgPacketUnpacker} from "./fcgPacketUnpacker";
import {CmdBeginRequest} from "./command/cmdBeginRequest";
import {CmdEndRequest} from "./command/cmdEndRequest";
import {CmdParams} from "./command/cmdParams";
import {CmdStdErr} from "./command/cmdStdErr";
import {CmdStdIn} from "./command/cmdStdIn";
import {CmdStdOut} from "./command/cmdStdOut";

export abstract class FcgProtocolHandler
    extends ProtocolHandler<FcgCommand, FcgPacket>
    implements FcgCommandHandler {
    protected constructor(
        pktStore: PacketStore<FcgPacket>,
        svrMode: boolean
    ) {
        super();
        this.commandUnpacker = new FcgCommandUnPacker(this);
        this.packetUnpacker = new FcgPacketUnpacker(pktStore, this.commandUnpacker as FcgCommandUnPacker);
        this.packetPacker = new PacketPacker<FcgPacket>();
        this.commandPacker = new CommandPacker<FcgCommand, FcgPacket, FcgCommandHandler>(this.packetPacker, pktStore);
        this.serverMode = svrMode;
    }

    abstract handleBeginRequest(cmd: CmdBeginRequest): number;
    abstract handleEndRequest(cmd: CmdEndRequest): number;
    abstract handleParams(cmd: CmdParams): number;
    abstract handleStdErr(cmd: CmdStdErr): number;
    abstract handleStdIn(cmd: CmdStdIn): number;
    abstract handleStdOut(cmd: CmdStdOut): number;

    /////////////////////////////////////////////////////////
    // Implements ProtocolHandler
    /////////////////////////////////////////////////////////

    protocol(): string {
        return FcgDockerConst.PROTO_NAME;
    }

    /**
     * Get max of request data size (maybe not packet size)
     */
    maxReqPacketDataSize(): number {
        return FcgPacket.MAXLEN;
    }

    /**
     * Get max of response data size (maybe not packet size)
     */
    maxResPacketDataSize(): number {
        return FcgPacket.MAXLEN;
    }
}