import {ClubBase} from "./clubBase";
import {LifeCycleListener} from "../../agent/lifeCycleListener";
import {Tour} from "../../tour/tour";
import {GrandAgent} from "../../agent/grandAgent";
import {Docker} from "../docker";
import {StrUtil} from "../../util/strUtil";
import {BcfElement} from "../../bcf/bcfElement";
import {BayLog} from "../../bayLog";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {WarpShip} from "../../common/warpShip";
import {WarpShipStore} from "../../common/warpShipStore";
import {ProtocolHandlerStore} from "../../protocol/protocolHandlerStore";
import {HttpException} from "../../httpException";
import {HttpStatus} from "../../util/httpStatus";
import {Rudder} from "../../rudder/rudder";
import {Ship} from "../../ship/ship";
import {Warp} from "../warp";
import * as net from "net";
import {SocketRudder} from "../../rudder/socketRudder";
import {Transporter} from "../../agent/multiplexer/transporter";
import {RudderState} from "../../agent/multiplexer/rudderState";


class AgentListener implements LifeCycleListener {

    docker: WarpBase

    constructor(docker: WarpBase) {
        this.docker = docker;
    }

    add(agtId: number) {
        this.docker.stores.set(agtId, new WarpShipStore(this.docker.maxShips))
    }

    remove(agtId: number) {
        this.docker.stores.delete(agtId)
    }

}

export abstract class WarpBase extends ClubBase implements  Warp{

    host: string
    port: number = -1
    warpBase: string
    maxShips: number = -1
    hostAddr: string
    timeoutSec: number = -1 // -1 means "Use harbor.socketTimeoutSec"

    tourList: Tour[] = []

    /** Agent ID => WarpShipStore */
    stores: Map<number, WarpShipStore> = null

    //////////////////////////////////////////////////////
    // Abstract methods
    //////////////////////////////////////////////////////

    abstract isSecure(): boolean
    abstract protocol(): string
    abstract newTransporter(agt: GrandAgent, rd: Rudder, sip: Ship): Transporter

    constructor() {
        super();
        this.stores = new Map()
    }

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        if(StrUtil.empty(this.warpBase))
            this.warpBase = "/";

        if(StrUtil.isSet(this.host) && this.host.startsWith(":unix:")) {
            this.hostAddr = this.host.substring(6);
            this.port = -1
        }
        else {
            if(this.port <= 0)
                this.port = 80;
            this.hostAddr = this.host
        }

        GrandAgent.addLifecycleListener(new AgentListener(this));
    }

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "destcity":
                this.host = kv.value;
                break;

            case "destport":
                this.port= Number.parseInt(kv.value);
                break;

            case "desttown":
                this.warpBase = kv.value;
                if (!this.warpBase.endsWith("/"))
                    this.warpBase += "/";
                break;

            case "maxships":
                this.maxShips = Number.parseInt(kv.value);
                break;

            case "timeout":
                this.timeoutSec = Number.parseInt(kv.value);
                break;

        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements Club
    //////////////////////////////////////////////////////

    arrive(tour: Tour) {
        let agt = GrandAgent.get(tour.ship.agentId);
        let sto = this.getShipStore(agt.agentId);

        let wsip = sto.rent();
        if(wsip == null) {
            throw new HttpException(HttpStatus.SERVICE_UNAVAILABLE, "WarpBase busy");
        }

        try {
            BayLog.trace("%s got from store", wsip);
            let needConnect = false;
            let tp: Transporter
            if (!wsip.initialized) {
                let skt = new net.Socket()
                let rd = new SocketRudder(skt)
                tp = this.newTransporter(agt, rd, wsip);
                let protoHnd = ProtocolHandlerStore.getStore(this.protocol(), false, agt.agentId).rent();
                wsip.initWarp(rd, agt.agentId, tp, this, protoHnd);

                BayLog.debug("%s init warp ship", wsip);
                needConnect = true;
            }

            this.tourList.push(tour);

            wsip.startWarpTour(tour);

            if(needConnect) {
                //agt.nonBlockingHandler.addChannelListener(wsip.ch, tp)
                agt.netMultiplexer.addRudderState(wsip.rudder, new RudderState(wsip.rudder, tp))
                agt.netMultiplexer.getTransporter(wsip.rudder).reqConnect(wsip.rudder, this.hostAddr, this.port)
            }

        }
        catch(e) {
            BayLog.error_e(e);
            throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, e);
        }
    }

    //////////////////////////////////////////////////////
    // Implements Warp
    //////////////////////////////////////////////////////

    getHost(): string {
        return this.host
    }

    getPort(): number {
        return this.port
    }

    getTimeoutSec(): number {
        return this.timeoutSec
    }

    getWarpBase(): string {
        return this.warpBase
    }

    keep(warpShip: Ship): void {
        BayLog.debug("%s keep warp ship: %s", this, warpShip)
        this.getShipStore(warpShip.agentId).keep(warpShip as WarpShip);
    }

    onEndShip(warpShip: Ship): void {
        let wsip = warpShip as WarpShip
        BayLog.debug("%s Return protocol handler: ", warpShip);
        this.getProtocolHandlerStore(warpShip.agentId).Return(wsip.protocolHandler);
        BayLog.debug("%s return warp ship", wsip);
        this.getShipStore(warpShip.agentId).Return(wsip);
    }


    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    getShipStore(agtId: number): WarpShipStore {
        return this.stores.get(agtId)
    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////

    getProtocolHandlerStore(agtId: number) {
        return ProtocolHandlerStore.getStore(this.protocol(), false, agtId);
    }


}