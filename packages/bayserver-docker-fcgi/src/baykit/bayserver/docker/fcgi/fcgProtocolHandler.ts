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
import {FcgHandler} from "./fcgHandler";
import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";

export class FcgProtocolHandler
    extends ProtocolHandler<FcgCommand, FcgPacket> {

    constructor(
        fcgHandler: FcgHandler,
        packetUnpacker: PacketUnpacker<FcgPacket>,
        packetPacker: PacketPacker<FcgPacket>,
        commandUnpacker: CommandUnPacker<FcgPacket>,
        commandPacker: CommandPacker<FcgCommand, FcgPacket, any>,
        svrMode: boolean
    ) {
        super(packetUnpacker, packetPacker, commandUnpacker, commandPacker, fcgHandler, svrMode);
    }

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