import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {H2Packet} from "./h2Packet";
import {H2Command} from "./h2Command";
import {H2CommandHandler} from "./h2CommandHandler";
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
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {H2CommandUnPacker} from "./h2CommandUnPacker";
import {H2PacketUnPacker} from "./h2PacketUnPacker";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";

export abstract class H2ProtocolHandler extends ProtocolHandler<H2Command, H2Packet> implements H2CommandHandler {
    abstract handleData(cmd: CmdData): number
    abstract handleGoAway(cmd: CmdGoAway): number
    abstract handleHeaders(cmd: CmdHeaders): number
    abstract handlePing(cmd: CmdPing): number
    abstract handlePreface(cmd: CmdPreface): number
    abstract handlePriority(cmd: CmdPriority): number
    abstract handleRstStream(cmd: CmdRstStream): number
    abstract handleSettings(cmd: CmdSettings): number
    abstract handleWindowUpdate(cmd: CmdWindowUpdate): number

    static readonly CTL_STREAM_ID = 0

    reqHeaderTbl = HeaderTable.createDynamicTable()
    resHeaderTbl = HeaderTable.createDynamicTable()

    constructor(pktStore: PacketStore<H2Packet>, svrMode: boolean) {
        super();
        this.commandUnpacker = new H2CommandUnPacker(this)
        this.packetUnpacker = new H2PacketUnPacker(this.commandUnpacker as H2CommandUnPacker, pktStore, svrMode)
        this.packetPacker = new PacketPacker<H2Packet>()
        this.commandPacker = new CommandPacker<H2Command, H2Packet, any>(this.packetPacker, pktStore)
        this.serverMode = svrMode
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