import {Ship} from "../../watercraft/ship";
import {Tour} from "../../tour/tour";
import {GrandAgent} from "../../agent/grandAgent";
import {Transporter} from "../../agent/transporter/transporter";
import {ProtocolHandler} from "../../protocol/protocolHandler";
import {BayServer} from "../../bayserver";
import {BayLog} from "../../bayLog";
import {WarpData} from "./warpData";
import {WarpDocker} from "./warpDocker";
import {WarpHandler} from "./warpHandler";
import {Sink} from "../../sink";
import {HttpStatus} from "../../util/httpStatus";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {Command} from "../../protocol/command";
import {ChannelWrapper} from "../../agent/channelWrapper";

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
    docker: WarpDocker
    tourMap: Map<number, WarpShip_TourWrapper>

    connected: boolean
    socketTimeoutSec: number
    private cmdBuf: [Command<any, any, any>, DataConsumeListener][] = []

    constructor() {
        super();
        this.tourMap = new Map()
    }

    initWarp(
        ch: ChannelWrapper,
        agt: GrandAgent,
        tp: Transporter,
        dkr: WarpDocker,
        protoHandler: ProtocolHandler<any, any>
    ): void {
        super.init(ch, agt, tp)
        this.docker = dkr
        this.socketTimeoutSec = dkr.timeoutSec >= 0 ? dkr.timeoutSec: BayServer.harbor.getSocketTimeoutSec()
        this.setProtocolHandler(protoHandler)
    }

    toString(): string {
        return this.agent + " wsip#" + this.shipId + "/" + this.objectId + "[" + this.protocol() + "]";
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
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    getDocker(): WarpDocker {
        return this.docker
    }

    getWarpHandler(): WarpHandler {
        return this.protocolHandler as Object as WarpHandler
    }

    startWarpTour(tur: Tour): void {
        let wHnd: WarpHandler = this.getWarpHandler();
        let warpId: number = wHnd.nextWarpId();
        let wdat: WarpData = wHnd.newWarpData(warpId);
        BayLog.debug("%s new warp tour related to %s", wdat, tur);
        tur.req.setContentHandler(wdat);

        BayLog.debug("%s start: warpId=%d", wdat, warpId);
        if(this.tourMap.has(warpId))
            throw new Sink("warpId exists");

        this.tourMap.set(warpId, new WarpShip_TourWrapper(tur.id(), tur))
        wHnd.postWarpHeaders(tur);

        if(this.connected) {
            BayLog.debug("%s is already connected. Just start warp tour:%s", wdat, tur);
            wdat.start();
        }
    }

    endWarpTour(tur: Tour): void {
        let wdat: WarpData = WarpData.get(tur);
        BayLog.debug("wrp#%d end (tur=%s): started=%b ended=%b", wdat.warpId, tur, wdat.started, wdat.ended);
        if(!this.tourMap.has(wdat.warpId))
            throw new Sink("%s WarpId not in tourMap: %d", tur, wdat.warpId);
        else
            this.tourMap.delete(wdat.warpId)
        this.docker.keepShip(this);
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
        this.postman.abort()
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
                tur.res.endContent(Tour.TOUR_ID_NOCHECK)
            }
        }
        this.tourMap = new Map()
    }

    endShip(): void {
        this.docker.returnProtocolHandler(this.agent, this.protocolHandler);
        this.docker.returnShip(this);
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