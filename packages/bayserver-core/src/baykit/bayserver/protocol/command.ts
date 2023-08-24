import {Packet} from "./packet";
import {CommandHandler} from "./commandHandler";

export abstract class Command<C extends Command<C, P, H>, P extends Packet, H extends CommandHandler<C>> {

    public type: number;

    public constructor(type: number) {
        this.type = type;
    }

    public abstract unpack(packet: P): void;

    public abstract pack(packet: P): void;

    // Call handler (visitor pattern)
    public abstract handle(handler: H): number;
}