import {PacketFactory} from "bayserver-core/baykit/bayserver/protocol/packetFactory";
import {H1Packet} from "./h1Packet";

export class H1PacketFactory extends PacketFactory<any> {
    createPacket(type: number): any {
        return new H1Packet(type)
    }

}