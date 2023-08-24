import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {AjpCommand} from "./ajpCommand";
import {AjpPacket} from "./ajpPacket";
import {AjpCommandHandler} from "./ajpCommandHandler";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {AjpCommandUnPacker} from "./ajpCommandUnPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CmdData} from "./command/cmdData";
import {CmdSendBodyChunk} from "./command/cmdSendBodyChunk";
import {AjpPacketUnpacker} from "./ajpPacketUnpacker";
import {AjpDockerConst} from "./ajpDockerConst";
import {CmdEndResponse} from "./command/cmdEndResponse";
import {CmdForwardRequest} from "./command/cmdForwardRequest";
import {CmdSendHeaders} from "./command/cmdSendHeaders";
import {CmdShutdown} from "./command/cmdShutdown";
import {CmdGetBodyChunk} from "./command/cmdGetBodyChunk";

export abstract class AjpProtocolHandler
    extends ProtocolHandler<AjpCommand, AjpPacket>
    implements AjpCommandHandler {
    protected constructor(
        pktStore: PacketStore<AjpPacket>,
        svrMode: boolean
    ) {
        super();
        this.commandUnpacker = new AjpCommandUnPacker(this);
        this.packetUnpacker = new AjpPacketUnpacker(pktStore, this.commandUnpacker as AjpCommandUnPacker);
        this.packetPacker = new PacketPacker<AjpPacket>();
        this.commandPacker = new CommandPacker<AjpCommand, AjpPacket, AjpCommandHandler>(this.packetPacker, pktStore);
        this.serverMode = svrMode;
    }

    abstract handleData(cmd: CmdData): number;
    abstract handleEndResponse(cmd: CmdEndResponse): number;
    abstract handleForwardRequest(cmd: CmdForwardRequest): number;
    abstract handleSendBodyChunk(cmd: CmdSendBodyChunk): number;
    abstract handleSendHeaders(cmd: CmdSendHeaders): number;
    abstract handleShutdown(cmd: CmdShutdown): number;
    abstract handleGetBodyChunk(cmd: CmdGetBodyChunk): number;
    abstract needData(): boolean;

    /////////////////////////////////////////////////////////
    // Implements ProtocolHandler
    /////////////////////////////////////////////////////////

    protocol(): string {
        return AjpDockerConst.PROTO_NAME;
    }

    /**
     * Get max of request data size (maybe not packet size)
     */
    maxReqPacketDataSize(): number {
        return CmdData.MAX_DATA_LEN;
    }

    /**
     * Get max of response data size (maybe not packet size)
     */
    maxResPacketDataSize(): number {
        return CmdSendBodyChunk.MAX_CHUNKLEN
    }

}