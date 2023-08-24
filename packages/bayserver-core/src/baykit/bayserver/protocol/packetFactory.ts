import {Packet} from "./packet";

export abstract class PacketFactory<P extends Packet> {
    public abstract createPacket(type: number): P;
}
