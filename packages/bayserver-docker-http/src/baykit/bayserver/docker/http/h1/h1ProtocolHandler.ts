import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {H1Command} from "./h1Command";
import {H1Packet} from "./h1Packet";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {HtpDockerConst} from "../htpDockerConst";
import {H1Handler} from "./h1Handler";
import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";
import {Ship} from "bayserver-core/baykit/bayserver/ship/ship";

export class H1ProtocolHandler extends ProtocolHandler<H1Command, H1Packet> {

    keeping: boolean;

    public constructor(
        h1Handler: H1Handler,
        packetUnpacker: PacketUnpacker<H1Packet>,
        packetPacker: PacketPacker<H1Packet>,
        commandUnpacker: CommandUnPacker<H1Packet>,
        commandPacker: CommandPacker<H1Command, H1Packet, any>,
        servsvrMode: boolean) {
        super(packetUnpacker, packetPacker, commandUnpacker, commandPacker, h1Handler, servsvrMode);
    }

    init(ship: Ship): void {
        super.init(ship)
    }

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