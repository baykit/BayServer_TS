import {PacketFactory} from "bayserver-core/baykit/bayserver/protocol/packetFactory";
import {FcgPacket} from "./fcgPacket";

export class FcgPacketFactory extends PacketFactory<FcgPacket> {
    createPacket(type: number): FcgPacket {
        return new FcgPacket(type);
    }
}