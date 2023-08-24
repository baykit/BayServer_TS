import {PacketFactory} from "bayserver-core/baykit/bayserver/protocol/packetFactory";
import {AjpPacket} from "./ajpPacket";

export class AjpPacketFactory extends PacketFactory<AjpPacket> {
    createPacket(type: number): AjpPacket {
        return new AjpPacket(type);
    }
}