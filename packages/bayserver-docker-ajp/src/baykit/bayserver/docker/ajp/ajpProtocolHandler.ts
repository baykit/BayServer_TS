import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {AjpCommand} from "./ajpCommand";
import {AjpPacket} from "./ajpPacket";
import {AjpCommandHandler} from "./ajpCommandHandler";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CmdData} from "./command/cmdData";
import {CmdSendBodyChunk} from "./command/cmdSendBodyChunk";
import {AjpDockerConst} from "./ajpDockerConst";
import {AjpHandler} from "./ajpHandler";
import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";

export class AjpProtocolHandler
    extends ProtocolHandler<AjpCommand, AjpPacket> {

    constructor(
        ajpHandler: AjpHandler,
        packetUnpacker: PacketUnpacker<AjpPacket>,
        packetPacker: PacketPacker<AjpPacket>,
        commandUnpacker: CommandUnPacker<AjpPacket>,
        commandPacker: CommandPacker<AjpCommand, AjpPacket, AjpCommandHandler>,
        svrMode: boolean
    ) {
        super(packetUnpacker, packetPacker, commandUnpacker, commandPacker, ajpHandler, svrMode)
    }

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