import {DataListener} from "../../agent/transporter/dataListener";
import {WarpShip} from "./warpShip";
import {ProtocolException} from "../../protocol/protocolException";
import {NextSocketAction} from "../../agent/nextSocketAction";
import {BayLog} from "../../bayLog";
import {WarpData} from "./warpData";
import {Tour} from "../../tour/tour";
import {HttpStatus} from "../../util/httpStatus";
import {WarpHandler} from "./warpHandler";
import {IOException} from "../../util/ioException";


export class WarpDataListener implements DataListener {

    ship: WarpShip


    constructor(ship: WarpShip) {
        this.ship = ship;
    }

    toString(): string {
        return this.ship.toString()
    }

    //////////////////////////////////////////////////////
    // Implements DataListener
    //////////////////////////////////////////////////////
    private WarpHandler: any;

    notifyHandshakeDone(protocol: string): number {
        (this.ship.protocolHandler as Object as WarpHandler).verifyProtocol(protocol);

        //  Send pending packet
        //this.ship.agent.nonBlockingHandler.askToWrite(ship.ch);
        return NextSocketAction.CONTINUE;
    }

    notifyConnect(): number {
        BayLog.debug("%s notifyConnect", this);
        this.ship.connected = true;
        for(const wp of this.ship.tourMap.values()) {
            wp.tour.checkTourId(wp.id);
            WarpData.get(wp.tour).start();
        }
        return NextSocketAction.CONTINUE;
    }

    notifyRead(buf: Buffer, adr): number {
        return this.ship.protocolHandler.bytesReceived(buf);
    }

    notifyEof(): number {
        BayLog.debug("%s EOF detected", this);

        if(this.ship.tourMap.size == 0) {
            BayLog.debug("%s No warp tour. only close", this);
            return NextSocketAction.CLOSE;
        }
        for(const [warpId, wp] of this.ship.tourMap.entries()) {
            wp.tour.checkTourId(wp.id);

            if (!wp.tour.res.headerSent) {
                BayLog.debug("%s Send ServiceUnavailable: tur=%s", this, wp.tour);
                wp.tour.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.SERVICE_UNAVAILABLE, "Server closed on reading headers");
            } else {
                // NOT treat EOF as Error
                BayLog.debug("%s EOF is not an error (send end content): tur=%s", this, wp.tour);
                try {
                    wp.tour.res.endContent(Tour.TOUR_ID_NOCHECK);
                }
                catch(e) {
                    if(e instanceof IOException) {
                        BayLog.debug_e(e, "%s end content error: tur=%s", this, wp.tour)
                    }
                    else {
                        throw e
                    }
                }
            }
        }
        this.ship.tourMap = new Map()

        return NextSocketAction.CLOSE;
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s notifyError: %s", this, err.message)
        this.ship.notifyErrorToOwnerTour(HttpStatus.SERVICE_UNAVAILABLE, this + " server closed")
    }

    notifyProtocolError(e: ProtocolException): boolean {
        BayLog.error_e(e);
        this.ship.notifyErrorToOwnerTour(HttpStatus.SERVICE_UNAVAILABLE, e.message);
        return true;
    }

    checkTimeout(durationSec: number): boolean {
        if(this.ship.isTimeout(durationSec)) {
            this.ship.notifyErrorToOwnerTour(HttpStatus.GATEWAY_TIMEOUT, this + " server timeout");
            return true;
        }
        else
            return false;
    };

    notifyClose() {
        BayLog.debug(this + " notifyClose");
        this.ship.endShip();
    }









}