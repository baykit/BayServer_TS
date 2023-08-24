import {CommandUnPacker} from "bayserver-core/baykit/bayserver/protocol/commandUnpacker";
import {H2Packet} from "./h2Packet";
import {H2CommandHandler} from "./h2CommandHandler";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {H2Command} from "./h2Command";
import {H2Type} from "./h2Type";
import {CmdPreface} from "./command/cmdPreface";
import {CmdHeaders} from "./command/cmdHeaders";
import {CmdPriority} from "./command/cmdPriority";
import {CmdSettings} from "./command/cmdSettings";
import {CmdWindowUpdate} from "./command/cmdWindowUpdate";
import {CmdData} from "./command/cmdData";
import {CmdGoAway} from "./command/cmdGoAway";
import {CmdPing} from "./command/cmdPing";
import {CmdRstStream} from "./command/cmdRstStream";

export class H2CommandUnPacker extends CommandUnPacker<H2Packet> {

    cmdHandler: H2CommandHandler

    constructor(cmdHandler: H2CommandHandler) {
        super()
        this.cmdHandler = cmdHandler
        this.reset();
    }


    reset() {
    }


    packetReceived(pkt: H2Packet): number {
        if(BayLog.isDebug())
            BayLog.debug("h2: read packet typ=" + pkt.type + " strmid=" + pkt.streamId + " len=" + pkt.dataLen() + " flgs=" + pkt.flags);

        let cmd: H2Command;
        switch (pkt.type) {
            case H2Type.PREFACE:
                cmd = new CmdPreface(pkt.streamId, pkt.flags);
                break;

            case H2Type.HEADERS:
                cmd = new CmdHeaders(pkt.streamId, pkt.flags);
                break;

            case H2Type.PRIORITY:
                cmd = new CmdPriority(pkt.streamId, pkt.flags);
                break;

            case H2Type.SETTINGS:
                cmd = new CmdSettings(pkt.streamId, pkt.flags);
                break;

            case H2Type.WINDOW_UPDATE:
                cmd = new CmdWindowUpdate(pkt.streamId, pkt.flags);
                break;

            case H2Type.DATA:
                cmd = new CmdData(pkt.streamId, pkt.flags);
                break;

            case H2Type.GOAWAY:
                cmd = new CmdGoAway(pkt.streamId, pkt.flags);
                break;

            case H2Type.PING:
                cmd = new CmdPing(pkt.streamId, pkt.flags);
                break;

            case H2Type.RST_STREAM:
                cmd = new CmdRstStream(pkt.streamId);
                break;

            default:
                throw new Error("Received packet: " + pkt);
        }

        cmd.unpack(pkt);
        return cmd.handle(this.cmdHandler);
    }

}