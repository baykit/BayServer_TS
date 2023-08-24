import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";
import {FcgPacket} from "./fcgPacket";
import {FcgCommandHandler} from "./fcgCommandHandler";
import {FcgType} from "./fcgType";
import {CmdBeginRequest} from "./command/cmdBeginRequest";
import {CmdEndRequest} from "./command/cmdEndRequest";
import {CmdParams} from "./command/cmdParams";
import {CmdStdIn} from "./command/cmdStdIn";
import {CmdStdOut} from "./command/cmdStdOut";
import {CmdStdErr} from "./command/cmdStdErr";
import {Sink} from "bayserver-core/baykit/bayserver/sink";

export class FcgCommandUnPacker extends CommandUnPacker<FcgPacket> {

    cmdHhandler: FcgCommandHandler;

    constructor(handler: FcgCommandHandler) {
        super()
        this.cmdHhandler = handler;
        this.reset()
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
    }

    //////////////////////////////////////////////////////
    // Implements CommandUnPacker
    //////////////////////////////////////////////////////

    public packetReceived(pkt: FcgPacket): number{

        let cmd;
        switch (pkt.type) {
            case FcgType.BEGIN_REQUEST:
                cmd = new CmdBeginRequest(pkt.reqId)
                break

            case FcgType.END_REQUEST:
                cmd = new CmdEndRequest(pkt.reqId)
                break

            case FcgType.PARAMS:
                cmd = new CmdParams(pkt.reqId)
                break

            case FcgType.STDIN:
                cmd = new CmdStdIn(pkt.reqId)
                break

            case FcgType.STDOUT:
                cmd = new CmdStdOut(pkt.reqId)
                break

            case FcgType.STDERR:
                cmd = new CmdStdErr(pkt.reqId)
                break

            default:
                throw new Sink();
        }

        cmd.unpack(pkt);
        return cmd.handle(this.cmdHhandler);
    }
}
