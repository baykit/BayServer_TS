import {Yacht} from "../watercraft/yacht";
import {Tour} from "./tour";
import {BayLog} from "../bayLog";
import {NextSocketAction} from "../agent/nextSocketAction";
import {Sink} from "../sink";
import {Valve} from "../util/valve";

export class SendFileYacht extends Yacht {

    file: string;
    fileLen: number;
    fileWroteLen: number;

    tour: Tour;
    tourId: number;

    constructor() {
        super()
        this.reset();
    }

    init(tur: Tour, file: string, fileLen: number, tp: Valve) {
        super.initYacht();
        this.tour = tur;
        this.tourId = tur.tourId;
        this.file = file;
        this.fileLen = fileLen;
        BayLog.debug("%s init file=%s", this, file)
        tur.res.setConsumeListener((len, resume) => {
            if(resume) {
                tp.openValve();
            }
        });
    }

    toString(): string {
        return "fyacht#" + this.yachtId + "/" + this.objectId + " tour=" + this.tour + " id=" + this.tourId;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset() {
        this.fileWroteLen = 0;
        this.tourId = 0;
        this.fileLen = 0;
        this.tour = null;
    }

    //////////////////////////////////////////////////////
    // Implements DataListener
    //////////////////////////////////////////////////////

    notifyRead(buf: Buffer, adr): number {
        this.checkInitialized()
        this.fileWroteLen += buf.length;
        BayLog.debug("%s read file %d bytes: total=%d/%d", this, buf.length, this.fileWroteLen, this.fileLen);
        let available: boolean = this.tour.res.sendContent(this.tourId, buf, 0, buf.length);

        if(available) {
            return NextSocketAction.CONTINUE;
        }
        else {
            return NextSocketAction.SUSPEND;
        }
    }

    notifyEof(): number {
        BayLog.debug("%s EOF(^o^) %s", this, this.file);
        this.checkInitialized()
        this.tour.res.endContent(this.tourId);
        return NextSocketAction.CLOSE;
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s Error: %s", this, err.message);
        this.checkInitialized()
        this.tour.res.sendError(this.tourId)
    }

    notifyClose() {
        BayLog.debug("File closed: %s", this.file);
    }

    private checkInitialized() {
        if(this.tour == null)
            throw new Sink("Invalid yacht")
        this.tour.checkTourId(this.tourId)
    }
}