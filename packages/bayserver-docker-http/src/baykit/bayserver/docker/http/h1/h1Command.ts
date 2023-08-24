import {Command} from "bayserver-core/baykit/bayserver/protocol/command";
import {H1Packet} from "./h1Packet";
import {H1CommandHandler} from "./h1CommandHandler";

export abstract class H1Command extends Command<H1Command, H1Packet, H1CommandHandler> {

    constructor(type: number) {
        super(type);
    }
}