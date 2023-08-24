import {H1Packet} from "./h1Packet";
import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";
import {H1CommandHandler} from "./h1CommandHandler";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {H1Command} from "./h1Command";
import {H1Type} from "./h1Type";
import {CmdHeader} from "./command/cmdHeader";
import {CmdContent} from "./command/cmdContent";

export class H1CommandUnPacker extends CommandUnPacker<H1Packet> {

    serverMode: boolean;
    handler: H1CommandHandler;

    constructor(handler: H1CommandHandler, svrMode: boolean) {
        super()
        this.handler = handler;
        this.serverMode = svrMode;
        this.reset();
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
    }

    //////////////////////////////////////////////////////
    // Implements CommandUnPacker
    //////////////////////////////////////////////////////

    public packetReceived(pac: H1Packet): number{

        BayLog.debug("%s h1: read packet type=%d length=%d", this.handler, pac.type, pac.dataLen());

        var cmd: H1Command;
        switch(pac.type) {
            case H1Type.HEADER:
                cmd = new CmdHeader(this.serverMode);
                break;

            case H1Type.CONTENT:
                cmd = new CmdContent(null, 0, 0);
                break;

            default:
                this.reset();
                throw new Error("Illegal argument");
        }

        cmd.unpack(pac);
        return cmd.handle(this.handler);
    }

    reqFinished(): boolean {
        return this.handler.reqFinished();
    }
}
