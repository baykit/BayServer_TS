import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {H2Packet} from "./h2Packet";
import {H2Command} from "./h2Command";
import {CmdData} from "./command/cmdData";
import {CmdGoAway} from "./command/cmdGoAway";
import {CmdHeaders} from "./command/cmdHeaders";
import {CmdPing} from "./command/cmdPing";
import {CmdPreface} from "./command/cmdPreface";
import {CmdPriority} from "./command/cmdPriority";
import {CmdRstStream} from "./command/cmdRstStream";
import {CmdSettings} from "./command/cmdSettings";
import {CmdWindowUpdate} from "./command/cmdWindowUpdate";
import {HeaderTable} from "./headerTable";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {H2Handler} from "./h2Handler";
import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";

export class H2ProtocolHandler extends ProtocolHandler<H2Command, H2Packet>{

    static readonly CTL_STREAM_ID = 0

    reqHeaderTbl = HeaderTable.createDynamicTable()
    resHeaderTbl = HeaderTable.createDynamicTable()

    constructor(
        h2Handler: H2Handler,
        packetUnpacker: PacketUnpacker<H2Packet>,
        packetPacker: PacketPacker<H2Packet>,
        commandUnpacker: CommandUnPacker<H2Packet>,
        commandPacker: CommandPacker<H2Command, H2Packet, any>,
        serverMode: boolean) {
        super(packetUnpacker, packetPacker, commandUnpacker, commandPacker, h2Handler, serverMode);
    }


    //////////////////////////////////////////////////////
    // Implements ProtocolHandler
    //////////////////////////////////////////////////////

    maxReqPacketDataSize(): number {
        return H2Packet.DEFAULT_PAYLOAD_MAXLEN;
    }

    maxResPacketDataSize(): number {
        return H2Packet.DEFAULT_PAYLOAD_MAXLEN;
    }


    protocol(): string {
        return "h2";
    }
}