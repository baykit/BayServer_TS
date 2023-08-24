import {Reusable} from "../util/Reusable";
import {PacketUnpacker} from "./packetUnpacker";
import {Command} from "./command";
import {Packet} from "./packet";
import {PacketPacker} from "./packetPacker";
import {CommandUnPacker} from "./commandUnpacker";
import {CommandPacker} from "./commandPacker";
import {PacketStore} from "./packetStore";
import {Ship} from "../watercraft/ship";

export abstract class ProtocolHandler <C extends Command<C, P, any>, P extends Packet>
    implements Reusable {

    public packetUnpacker: PacketUnpacker<P> ;
    public packetPacker: PacketPacker<P>;
    public commandUnpacker: CommandUnPacker<P>;
    public commandPacker: CommandPacker<C, P, any>;
    public packetStore: PacketStore<P>;
    public serverMode: boolean;
    public ship: Ship;

    public abstract protocol(): string;

    /**
     * Get max of request data size (maybe not packet size)
     */
    public abstract maxReqPacketDataSize(): number;

    /**
     * Get max of response data size (maybe not packet size)
     */
    public abstract maxResPacketDataSize(): number;

    public toString(): string {
        return "PH:ship=" + this.ship;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    public reset(): void {
        this.commandUnpacker.reset();
        this.commandPacker.reset();
        this.packetPacker.reset();
        this.packetUnpacker.reset();
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    public bytesReceived(buf: Buffer): number {
        return this.packetUnpacker.bytesReceived(buf);
    }
}