import {AjpPacket} from "./ajpPacket";
import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";
import {AjpCommandHandler} from "./ajpCommandHandler";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {AjpType} from "./ajpType";
import {CmdData} from "./command/cmdData";
import {CmdForwardRequest} from "./command/cmdForwardRequest";
import {CmdSendBodyChunk} from "./command/cmdSendBodyChunk";
import {CmdSendHeaders} from "./command/cmdSendHeaders";
import {CmdEndResponse} from "./command/cmdEndResponse";
import {CmdShutdown} from "./command/cmdShutdown";
import {CmdGetBodyChunk} from "./command/cmdGetBodyChunk";
import {Sink} from "bayserver-core/baykit/bayserver/sink";


export class AjpCommandUnPacker extends CommandUnPacker<AjpPacket> {

    cmdHhandler: AjpCommandHandler;

    constructor(handler: AjpCommandHandler) {
        super()
        this.cmdHhandler = handler;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
    }

    //////////////////////////////////////////////////////
    // Implements CommandUnPacker
    //////////////////////////////////////////////////////

    public packetReceived(pkt: AjpPacket): number{

        BayLog.debug("ajp:  packet received: type=%s datalen=%d", pkt.type, pkt.dataLen());
        let cmd;
        switch (pkt.type) {
            case AjpType.DATA:
                cmd = new CmdData();
                break;
            case AjpType.FORWARD_REQUEST:
                cmd = new CmdForwardRequest();
                break;
            case AjpType.SEND_BODY_CHUNK:
                cmd = new CmdSendBodyChunk(pkt.buf, pkt.headerLen, pkt.dataLen());
                break;
            case AjpType.SEND_HEADERS:
                cmd = new CmdSendHeaders();
                break;
            case AjpType.END_RESPONSE:
                cmd = new CmdEndResponse();
                break;
            case AjpType.SHUTDOWN:
                cmd = new CmdShutdown();
                break;
            case AjpType.GET_BODY_CHUNK:
                cmd = new CmdGetBodyChunk();
                break;
            default:
                throw new Sink();
        }

        cmd.unpack(pkt);
        return cmd.handle(this.cmdHhandler);
    }

    needData(): boolean {
        return this.cmdHhandler.needData();
    }
}
