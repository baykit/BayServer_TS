import {PacketFactory} from "bayserver-core/baykit/bayserver/protocol/packetFactory";
import {H2Packet} from "./h2Packet";

export class H2PacketFactory extends PacketFactory<H2Packet> {
    createPacket(type: number): H2Packet {
        return new H2Packet(type);
    }
}