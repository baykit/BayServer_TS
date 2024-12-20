import {Reusable} from "../util/Reusable";
import {PacketUnpacker} from "./packetUnpacker";
import {Command} from "./command";
import {Packet} from "./packet";
import {PacketPacker} from "./packetPacker";
import {CommandUnPacker} from "./commandUnpacker";
import {CommandPacker} from "./commandPacker";
import {Ship} from "../ship/ship";
import {CommandHandler} from "./commandHandler";
import {Buffer} from "buffer";
import {DataConsumeListener} from "../util/dataConsumeListener";

export abstract class ProtocolHandler <C extends Command<C, P, CommandHandler<C>>, P extends Packet>
    implements Reusable {

    readonly packetUnpacker: PacketUnpacker<P> ;
    readonly packetPacker: PacketPacker<P>;
    readonly commandUnpacker: CommandUnPacker<P>;
    readonly commandPacker: CommandPacker<C, P, CommandHandler<C>>;
    readonly commandHandler: CommandHandler<C>
    readonly serverMode: boolean;
    ship: Ship;


    protected constructor(
        packetUnpacker: PacketUnpacker<P>,
        packetPacker: PacketPacker<P>,
        commandUnpacker: CommandUnPacker<P>,
        commandPacker: CommandPacker<C, P, CommandHandler<C>>,
        commandHandler: CommandHandler<C>,
        serverMode: boolean) {
        this.packetUnpacker = packetUnpacker;
        this.packetPacker = packetPacker;
        this.commandUnpacker = commandUnpacker;
        this.commandPacker = commandPacker;
        this.commandHandler = commandHandler;
        this.serverMode = serverMode;
    }

    abstract protocol(): string;

    /**
     * Get max of request data size (maybe not packet size)
     */
    abstract maxReqPacketDataSize(): number;

    /**
     * Get max of response data size (maybe not packet size)
     */
    abstract maxResPacketDataSize(): number;

    init(ship: Ship): void {
        this.ship = ship
    }

    toString(): string {
        return "PH:ship=" + this.ship;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
        this.commandUnpacker.reset();
        this.commandPacker.reset();
        this.packetPacker.reset();
        this.packetUnpacker.reset();
        this.commandHandler.reset()
        this.ship = null
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    bytesReceived(buf: Buffer): number {
        return this.packetUnpacker.bytesReceived(buf);
    }

    post(cmd: C, listener: DataConsumeListener = null): void {
        this.commandPacker.post(this.ship, cmd, listener)
    }
}