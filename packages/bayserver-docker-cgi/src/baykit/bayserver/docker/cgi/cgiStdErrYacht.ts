import {Yacht} from "bayserver-core/baykit/bayserver/watercraft/yacht";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {CgiReqContentHandler} from "./cgiReqContentHandler";
import {Sink} from "bayserver-core/baykit/bayserver/sink";

export class CgiStdErrYacht extends Yacht {

    tour: Tour

    tourId: number

    constructor() {
        super();
        this.reset()
    }

    init(tur: Tour) {
        super.initYacht();
        this.tour = tur;
        this.tourId = tur.tourId;
    }

    toString(): string {
        return "CGIErrYat#{" + this.yachtId + "/" + this.objectId + " tour=" + this.tour + " id=" + this.tourId;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset() {
        this.tourId = 0;
        this.tour = null;
    }

    //////////////////////////////////////////////////////
    // Implements Yacht
    //////////////////////////////////////////////////////

    notifyRead(buf: Buffer, adr): number {
        BayLog.debug("%s CGI StdErr %d bytesd", this, buf.length);
        let msg = buf.toString("latin1", 0, buf.length);
        if(msg.length > 0)
            BayLog.error("CGI Stderr: %s", msg);

        return NextSocketAction.CONTINUE;
    }

    notifyEof(): number {
        BayLog.debug("%s CGI StdErr: EOF\\(^o^)/", this);
        return NextSocketAction.CLOSE;
    }

    notifyError(err: Error): void {
        BayLog.error_e(err, "%s CGI StdErr: Error(>_<): %s", this, err.message);
        this.tour.res.sendError(this.tourId);
    }

    notifyClose() {
        BayLog.debug("%s CGI StdErr: notifyClose", this);
        this.tour.checkTourId(this.tourId);
        (this.tour.req.contentHandler as CgiReqContentHandler).stdErrClosed();
    }

    checkTimeout(durationSec: number): boolean {
        throw new Sink("%s invalid timeout check", this)
    }






}
