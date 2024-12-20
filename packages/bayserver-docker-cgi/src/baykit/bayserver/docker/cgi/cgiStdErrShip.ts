import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {CgiReqContentHandler} from "./cgiReqContentHandler";
import {ReadOnlyShip} from "bayserver-core/baykit/bayserver/common/readOnlyShip";
import {Rudder} from "bayserver-core/baykit/bayserver/rudder/rudder";

export class CgiStdErrShip extends ReadOnlyShip {

    handler: CgiReqContentHandler

    initStdErr(rd: Rudder, agtId: number, handler: CgiReqContentHandler) {
        super.init(agtId, rd, null)
        this.handler = handler
    }

    toString(): string {
        return "agt#" + this.agentId + " err_sip#" + this.shipId + "/" + this.objectId;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset() {
        super.reset()
        this.handler = null
    }

    //////////////////////////////////////////////////////
    // Implements Ship
    //////////////////////////////////////////////////////

    notifyRead(buf: Buffer): number {
        BayLog.debug("%s CGI StdErr %d bytesd", this, buf.length);
        let msg = buf.toString("latin1", 0, buf.length);
        if(msg.length > 0)
            BayLog.error("CGI Stderr: %s", msg);

        this.handler.access()
        return NextSocketAction.CONTINUE;
    }

    notifyEof(): number {
        BayLog.debug("%s CGI StdErr: EOF\\(^o^)/", this);
        return NextSocketAction.CLOSE;
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s CGI StdErr: Error(>_<): %s",  err.message);
    }

    notifyClose() {
        BayLog.debug("%s CGI StdErr: notifyClose", this);
        this.handler.stdErrClosed();
    }

    checkTimeout(durationSec: number): boolean {
        BayLog.debug("%s Check StdErr timeout: dur=%d", this, durationSec)
        return this.handler.timedOut()
    }






}
