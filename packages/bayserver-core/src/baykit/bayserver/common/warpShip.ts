import {Ship} from "../ship/ship";
import {Tour} from "../tour/tour";
import {ProtocolHandler} from "../protocol/protocolHandler";
import {BayServer} from "../bayserver";
import {BayLog} from "../bayLog";
import {WarpData} from "./warpData";
import {WarpBase} from "../docker/base/warpBase";
import {WarpHandler} from "./warpHandler";
import {Sink} from "../sink";
import {HttpStatus} from "../util/httpStatus";
import {DataConsumeListener} from "../util/dataConsumeListener";
import {Command} from "../protocol/command";
import {Rudder} from "../rudder/rudder";
import {Transporter} from "../agent/multiplexer/transporter";
import {Buffer} from "buffer";
import {NextSocketAction} from "../agent/nextSocketAction";
import {IOException} from "../util/ioException";
import {ProtocolException} from "../protocol/protocolException";

export class WarpShip_TourWrapper {
    id: number
    tour: Tour

    constructor(id: number, tour: Tour) {
        this.id = id;
        this.tour = tour;
    }

    toString(): string {
        return "<" + this.id + "," + this.tour.toString() + ">"
    }
}

export class WarpShip extends Ship {
    docker: WarpBase
    tourMap: Map<number, WarpShip_TourWrapper>

    protocolHandler: ProtocolHandler<any, any>
    connected: boolean
    socketTimeoutSec: number
    private cmdBuf: [Command<any, any, any>, DataConsumeListener][] = []

    constructor() {
        super();
        this.tourMap = new Map()
    }

    initWarp(
        rd: Rudder,
        agtId: number,
        tp: Transporter,
        dkr: WarpBase,
        protoHandler: ProtocolHandler<any, any>
    ): void {
        super.init(agtId, rd, tp)
        this.docker = dkr
        this.socketTimeoutSec = dkr.timeoutSec >= 0 ? dkr.timeoutSec: BayServer.harbor.getSocketTimeoutSec()
        this.protocolHandler = protoHandler
        protoHandler.init(this)
    }

    toString(): string {
        return "agt#" + this.agentId + " wsip#" + this.shipId + "/" + this.objectId +
            (this.protocolHandler != null ? ("[" + this.protocolHandler.protocol() + "]") : "")
    }

    //////////////////////////////////////////////////////
    // implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
        super.reset()
        if(this.tourMap.size != 0)
            BayLog.error("BUG: %s Some tours is active: %s", this, this.tourMap);
        this.connected = false;
        this.tourMap.clear()
        this.cmdBuf.length = 0
        this.protocolHandler = null
    }

    //////////////////////////////////////////////////////
    // implements Ship
    //////////////////////////////////////////////////////

    notifyHandshakeDone(protocol: string): number {
        (this.protocolHandler as Object as WarpHandler).verifyProtocol(protocol);
        return NextSocketAction.CONTINUE;
    }

    notifyConnect(): number {
        BayLog.debug("%s notifyConnect", this);
        this.connected = true;
        for(const wp of this.tourMap.values()) {
            wp.tour.checkTourId(wp.id);
            WarpData.get(wp.tour).start();
        }
        return NextSocketAction.CONTINUE;
    }

    notifyRead(buf: Buffer): number {
        return this.protocolHandler.bytesReceived(buf);
    }

    notifyEof(): number {
        BayLog.debug("%s EOF detected", this);

        if(this.tourMap.size == 0) {
            BayLog.debug("%s No warp tour. only close", this);
            return NextSocketAction.CLOSE;
        }
        for(const [warpId, wp] of this.tourMap.entries()) {
            wp.tour.checkTourId(wp.id);

            try {
                if (!wp.tour.res.headerSent) {
                    BayLog.debug("%s Send ServiceUnavailable: tur=%s", this, wp.tour);
                    wp.tour.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.SERVICE_UNAVAILABLE, "Server closed on reading headers");
                }
                else {
                    // NOT treat EOF as Error
                    BayLog.debug("%s EOF is not an error (send end content): tur=%s", this, wp.tour);
                    wp.tour.res.endResContent(Tour.TOUR_ID_NOCHECK);
                }
            }
            catch(e) {
                if(e instanceof IOException) {
                    BayLog.debug_e(e)
                }
                else {
                    throw e
                }
            }
        }
        this.tourMap = new Map()

        return NextSocketAction.CLOSE;
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s notifyError: %s", this, err.message)
        this.notifyErrorToOwnerTour(HttpStatus.SERVICE_UNAVAILABLE, this + " server closed")
    }

    notifyProtocolError(e: ProtocolException): boolean {
        BayLog.error_e(e);
        this.notifyErrorToOwnerTour(HttpStatus.SERVICE_UNAVAILABLE, e.message);
        return true;
    }

    notifyClose(): void {
        BayLog.debug(this + " notifyClose");
        this.notifyErrorToOwnerTour(HttpStatus.SERVICE_UNAVAILABLE, this + " server closed");
        this.endShip();
    }

    checkTimeout(durationSec: number): boolean {
        if(this.isTimeout(durationSec)) {
            this.notifyErrorToOwnerTour(HttpStatus.GATEWAY_TIMEOUT, this + " server timeout");
            return true;
        }
        else
            return false;
    };


    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    getDocker(): WarpBase {
        return this.docker
    }

    getWarpHandler(): WarpHandler {
        return this.protocolHandler.commandHandler as Object as WarpHandler
    }

    startWarpTour(tur: Tour): void {
        let wHnd: WarpHandler = this.getWarpHandler();
        let warpId: number = wHnd.nextWarpId();
        let wdat: WarpData = wHnd.newWarpData(warpId);
        BayLog.debug("%s new warp tour related to %s", wdat, tur);
        tur.req.setReqContentHandler(wdat);

        BayLog.debug("%s start: warpId=%d", wdat, warpId);
        if(this.tourMap.has(warpId))
            throw new Sink("warpId exists");

        this.tourMap.set(warpId, new WarpShip_TourWrapper(tur.id(), tur))
        wHnd.sendReqHeaders(tur);

        if(this.connected) {
            BayLog.debug("%s is already connected. Just start warp tour:%s", wdat, tur);
            wdat.start();
        }
    }

    endWarpTour(tur: Tour, keep: boolean): void {
        let wdat: WarpData = WarpData.get(tur);
        BayLog.debug("%s end (tur=%s): started=%b ended=%b", wdat, tur, wdat.started, wdat.ended);
        if(!this.tourMap.has(wdat.warpId))
            throw new Sink("%s WarpId not in tourMap: %d", tur, wdat.warpId);
        else
            this.tourMap.delete(wdat.warpId)

        if(keep) {
            BayLog.debug("%s keep warp ship", this);
            this.docker.keep(this);
        }
    }

    notifyServiceUnavailable(msg: string): void {
        this.notifyErrorToOwnerTour(HttpStatus.SERVICE_UNAVAILABLE, msg);
    }

    getTour(warpId: number, must: boolean = true): Tour {
        let wpr: WarpShip_TourWrapper = this.tourMap.get(warpId)
        if(wpr != null) {
            wpr.tour.checkTourId(wpr.id);
            if (!WarpData.get(wpr.tour).ended) {
                return wpr.tour;
            }
        }

        if(must)
            throw new Sink("%s warp tours not found: id=%d", this, warpId);
        else
            return null;
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    abort(checkId: number) {
        this.checkShipId(checkId)
        this.transporter.reqClose(this.rudder)
    }

    isTimeout(duration: number): boolean {
        var timeout: boolean
        if(this.keeping) {
            // warp connection never timeout in keeping
            timeout = false;
        }
        else if (this.socketTimeoutSec <= 0)
            timeout = false;
        else
            timeout = duration >= this.socketTimeoutSec;

        BayLog.debug(this + " Warp check timeout: dur=" + duration + ", timeout=" + timeout + ", keeping=" + this.keeping + " limit=" + this.socketTimeoutSec);
        return timeout;
    }

    notifyErrorToOwnerTour(status: number, msg: string): void {
        for(const warpId of this.tourMap.keys()) {
            let tur: Tour = this.getTour(warpId);
            BayLog.debug("%s send error to owner: %s running=%b", this, tur, tur.isRunning());
            if (tur.isRunning()) {
                try {
                    tur.res.sendError(Tour.TOUR_ID_NOCHECK, status, msg);
                } catch (e) {
                    BayLog.error_e(e);
                }
            }
            else {
                tur.res.endResContent(Tour.TOUR_ID_NOCHECK)
            }
        }
        this.tourMap = new Map()
    }

    endShip(): void {
        this.docker.onEndShip(this);
    }

    public post(cmd: Command<any, any, any>, listener: () => void = null): void {
        if(!this.connected)
            this.cmdBuf.push([cmd, listener])
        else {
            if(cmd == null)
                listener()
            else
                this.protocolHandler.commandPacker.post(this, cmd, listener)
        }
    }

    public flush() {
        for(const cmdAndLis of this.cmdBuf) {
            let cmd = cmdAndLis[0]
            let lis = cmdAndLis[1]
            if(cmd == null)
                lis()
            else
                this.protocolHandler.commandPacker.post(this, cmd, lis)
        }
        this.cmdBuf = []
    }


}