import {Yacht} from "bayserver-core/baykit/bayserver/watercraft/yacht";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {CgiReqContentHandler} from "./cgiReqContentHandler";
import {Sink} from "bayserver-core/baykit/bayserver/sink";
import {CharUtil} from "bayserver-core/baykit/bayserver/util/charUtil";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {Valve} from "bayserver-core/baykit/bayserver/util/valve";

export class CgiStdOutYacht extends Yacht {
    fileWroteLen: number

    tour: Tour
    tourId: number

    remain: string = ""
    headerReading: boolean

    constructor() {
        super();
        this.reset()
    }

    init(tur: Tour, vv: Valve) {
        super.initYacht();
        this.tour = tur;
        this.tourId = tur.tourId;
        tur.res.setConsumeListener((len, resume)=> {
            if(resume) {
                vv.openValve();
            }
        });
    }

    toString(): string {
        return "CGIOutYat#{" + this.yachtId + "/" + this.objectId + " tour=" + this.tour + " id=" + this.tourId;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset() {
        this.fileWroteLen = 0
        this.tourId = 0;
        this.tour = null;
        this.headerReading = true
        this.remain = ""
    }

    //////////////////////////////////////////////////////
    // Implements Yacht
    //////////////////////////////////////////////////////

    notifyRead(buf: Buffer, adr): number {
        this.fileWroteLen += buf.length
        BayLog.debug("%s CGI StdOut: read %s bytes: wrote %d", this, buf.length, this.fileWroteLen);

        let pos = 0
        if (this.headerReading) {

            while(true) {
                let p = buf.indexOf(CharUtil.LF_CODE, pos)

                if(p == -1)
                    break

                let line = buf.toString("latin1", pos, p)
                pos = p + 1

                if(this.remain.length > 0) {
                    line = this.remain + line;
                    this.remain = "";
                }

                line = line.trim();
                //BayLog.debug("line: %s", line);

                //  if line is empty ("\r\n")
                //  finish header reading.
                if (StrUtil.empty(line)) {
                    this.headerReading = false;
                    this.tour.res.sendHeaders(this.tourId);
                    break;
                } else {
                    if(BayServer.harbor.isTraceHeader()) {
                        BayLog.info("%s CGI: res header line: %s", this.tour, line);
                    }

                    let sepPos = line.indexOf(':');
                    if (sepPos >= 0) {
                        let key = line.substring(0, sepPos).trim();
                        let val = line.substring(sepPos + 1).trim();
                        if (StrUtil.eqIgnoreCase(key, "status")) {
                            try {
                                let parts = val.split(" ")
                                this.tour.res.headers.status = Number.parseInt(parts[0]);
                            }
                            catch(e) {
                                BayLog.error_e(e);
                            }
                        }
                        else
                            this.tour.res.headers.add(key, val);
                    }
                }
            }
        }

        let available = true;

        if(this.headerReading) {
            this.remain += buf.toString("latin1", pos)
        }
        else {
            if(buf.length - pos > 0) {
                available = this.tour.res.sendContent(this.tourId, buf, pos,  buf.length - pos);
            }
        }

        if(available)
            return NextSocketAction.CONTINUE;
        else
            return NextSocketAction.SUSPEND;
    }

    notifyEof(): number {
        BayLog.debug("%s CGI StdOut: EOF\\(^o^)/", this);
        return NextSocketAction.CLOSE;
    }

    notifyError(err: Error): void {
        BayLog.error_e(err, "%s CGI StdOut: Error(>_<): %s", this, err.message);
        this.tour.res.sendError(this.tourId);
    }

    notifyClose() {
        BayLog.debug("%s CGI StdOut: notifyClose", this);
        this.tour.checkTourId(this.tourId);
        (this.tour.req.contentHandler as CgiReqContentHandler).stdOutClosed();
    }

    checkTimeout(durationSec: number): boolean {
        throw new Sink("%s invalid timeout check", this)
    }


}
