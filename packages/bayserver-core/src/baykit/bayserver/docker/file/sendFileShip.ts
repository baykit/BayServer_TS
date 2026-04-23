import {ReadOnlyShip} from "../../common/readOnlyShip";
import {Tour} from "../../tour/tour";
import {Rudder} from "../../rudder/rudder";
import {Transporter} from "../../common/transporter";
import {Buffer} from "buffer";
import {BayLog} from "../../bayLog";
import {NextSocketAction} from "../../agent/nextSocketAction";
import {IOException} from "../../util/ioException";
import {HttpStatus} from "../../util/httpStatus";
import {FileContent} from "./fileContent";

export class SendFileShip extends ReadOnlyShip {

    fileWroteLen: number
    fileContent: FileContent
    tour: Tour
    tourId: number


    initSendFileShip(rd: Rudder, tp : Transporter, tur: Tour, fileContent: FileContent = null): void {
        super.init(tur.ship.agentId, rd, tp);
        this.fileWroteLen = 0;
        this.fileContent = fileContent;
        this.tour = tur;
        this.tourId = tur.tourId;
    }

    toString(): string {
        return "agt#" + this.agentId + " send_file#" + this.shipId + "/" + this.objectId;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
        super.reset()
        this.fileContent = null
    }

    //////////////////////////////////////////////////////
    // Implements Ship
    //////////////////////////////////////////////////////

    notifyRead(buf: Buffer): number {
        this.fileWroteLen += buf.length
        BayLog.debug("%s read file %d bytes: total=%d", this, buf.length, this.fileWroteLen);

        try {
            let available = this.tour.res.sendResContent(this.tourId, buf, 0, buf.length);

            if (this.fileContent != null) {
                this.fileContent.append(buf, buf.length);
            }

            if(available) {
                return NextSocketAction.CONTINUE;
            }
            else {
                return NextSocketAction.SUSPEND;
            }
        }
        catch(e) {
            if (e instanceof IOException) {
                this.notifyError(e);
                return NextSocketAction.CLOSE;
            }
            else {
                throw e
            }
        }
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s Error notified", this);
        try {
            this.tour.res.sendError(this.tourId, HttpStatus.INTERNAL_SERVER_ERROR, null, err);
        }
        catch(e) {
            if (e instanceof IOException) {
                BayLog.debug_e(e)
            }
            else {
                throw e
            }
        }
    }

    notifyEof(): number {
        BayLog.debug("%s EOF", this);
        try {
            this.tour.res.endResContent(this.tourId);
        }
        catch(e) {
            if (e instanceof IOException) {
                BayLog.debug_e(e)
            }
            else {
                throw e
            }
        }
        return NextSocketAction.CLOSE
    }

    notifyClose(): void {
    }

    checkTimeout(durationSec: number): boolean {
        return false;
    }


}