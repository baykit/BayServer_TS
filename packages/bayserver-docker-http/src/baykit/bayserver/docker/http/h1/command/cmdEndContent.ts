import {H1Command} from "../h1Command";
import {H1CommandHandler} from "../h1CommandHandler";
import {H1Packet} from "../h1Packet";
import {H1Type} from "../h1Type";

/**
 * Dummy packet (empty packet) to notify contents are sent
 */
export class CmdEndContent extends H1Command {

    constructor() {
        super(H1Type.END_CONTENT);
    }
    handle(handler: H1CommandHandler): number {
        return 0;
    }

    pack(packet: H1Packet): void {
    }

    unpack(packet: H1Packet): void {
    }

}