import {ReadOnlyShip} from "../../common/readOnlyShip";
import {Tour} from "../../tour/tour";
import {Rudder} from "../../rudder/rudder";
import {Transporter} from "../../common/transporter";
import {Buffer} from "buffer";
import {BayLog} from "../../bayLog";
import {NextSocketAction} from "../../agent/nextSocketAction";
import {IOException} from "../../util/ioException";
import {HttpStatus} from "../../util/httpStatus";
import {HttpException} from "../../httpException";
import {Sink} from "../../sink";
import {Barge} from "../barge";
import {Club} from "../club";
import {ContentConsumeListenerUtil} from "../../tour/contentConsumeListener";

export class WaitCargoShip extends ReadOnlyShip {

    cargo: Barge.Cargo
    club: Club
    tour: Tour
    tourId: number

    initWaitCargo(rd: Rudder, tp: Transporter, tur: Tour, cgo: Barge.Cargo, clb: Club): void {
        super.init(tur.ship.agentId, rd, tp);
        this.tour = tur;
        this.tourId = tur.tourId;
        this.cargo = cgo;
        this.club = clb;
    }

    toString(): string {
        return "agt#" + this.agentId + " wait_file#" + this.shipId + "/" + this.objectId;
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
        super.reset();
        this.tourId = 0;
        this.tour = null;
    }

    //////////////////////////////////////////////////////
    // Implements ReadOnlyShip
    //////////////////////////////////////////////////////

    /**
     * Waked up by pipe
     */
    notifyRead(buf: Buffer): number {
        BayLog.debug("%s cargo load completed", this.tour);

        try {
            if (this.cargo.isExceeded()) {
                BayLog.debug("%s cargo exceeded", this.tour);
                this.club.arrive(this.tour);
            }
            else {
                this.tour.res.setConsumeListener(ContentConsumeListenerUtil.devNull);
                this.sendCargoOnBoard();
            }
        }
        catch (e) {
            if (e instanceof HttpException) {
                try {
                    this.tour.res.sendError(Tour.TOUR_ID_NOCHECK, e.status, e.message);
                }
                catch (ex) {
                    if (ex instanceof IOException) {
                        this.notifyError(ex);
                        return NextSocketAction.CLOSE;
                    }
                    else {
                        throw ex;
                    }
                }
            }
            else {
                throw e;
            }
        }

        this.cargo.releaseRudder(this.rudder);

        return NextSocketAction.CONTINUE;
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s Error notified", this.tour);
        try {
            this.tour.res.sendError(this.tourId, HttpStatus.INTERNAL_SERVER_ERROR, null, err);
        }
        catch (e) {
            if (e instanceof IOException) {
                BayLog.debug_e(e);
            }
            else {
                throw e;
            }
        }
    }

    notifyEof(): number {
        throw new Sink();
    }

    notifyClose(): void {
    }

    checkTimeout(durationSec: number): boolean {
        return false;
    }

    private sendCargoOnBoard(): void {
        this.tour.res.setConsumeListener(ContentConsumeListenerUtil.devNull);
        this.cargo.getHeaders().copyTo(this.tour.res.headers);
        try {
            this.tour.res.sendHeaders(Tour.TOUR_ID_NOCHECK);
            this.tour.res.sendResContent(
                Tour.TOUR_ID_NOCHECK, this.cargo.getContent(), 0, this.cargo.getLength());
            this.tour.res.endResContent(Tour.TOUR_ID_NOCHECK);
        }
        catch (e) {
            if (e instanceof IOException) {
                BayLog.error_e(e);
                throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, this.cargo.getPath());
            }
            throw e;
        }
    }
}
