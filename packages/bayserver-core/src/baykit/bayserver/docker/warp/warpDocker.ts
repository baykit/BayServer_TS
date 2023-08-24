import {ClubBase} from "../base/clubBase";
import {LifeCycleListener} from "../../agent/lifeCycleListener";
import {Tour} from "../../tour/tour";
import {GrandAgent} from "../../agent/grandAgent";
import * as net from "net";
import {Transporter} from "../../agent/transporter/transporter";
import {Docker} from "../docker";
import {StrUtil} from "../../util/strUtil";
import {BcfElement} from "../../bcf/bcfElement";
import {SysUtil} from "../../util/sysUtil";
import {ConfigException} from "../../configException";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {BayLog} from "../../bayLog";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {WarpShip} from "./warpShip";
import {ProtocolHandler} from "../../protocol/protocolHandler";
import {WarpShipStore} from "./warpShipStore";
import {ProtocolHandlerStore} from "../../protocol/protocolHandlerStore";
import {HttpException} from "../../httpException";
import {HttpStatus} from "../../util/httpStatus";
import {WarpDataListener} from "./warpDataListener";
import {ChannelWrapper} from "../../agent/channelWrapper";


class AgentListener implements LifeCycleListener {

    docker: WarpDocker

    constructor(docker: WarpDocker) {
        this.docker = docker;
    }

    add(agtId: number) {
        this.docker.stores.set(agtId, new WarpShipStore(this.docker.maxShips))
    }

    remove(agtId: number) {
        this.docker.stores.delete(agtId)
    }

}

export abstract class WarpDocker extends ClubBase {

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
    abstract newTransporter(agt: GrandAgent, ch: ChannelWrapper): Transporter

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
        let agt = tour.ship.agent;
        let sto = this.getShipStore(agt.agentId);

        let wsip = sto.rent();
        if(wsip == null) {
            throw new HttpException(HttpStatus.SERVICE_UNAVAILABLE, "WarpDocker busy");
        }

        try {
            BayLog.trace("%s got from store", wsip);
            let needConnect = false;
            let tp: Transporter
            if (!wsip.initialized) {
                let skt = new net.Socket()
                let ch = new ChannelWrapper(skt)
                tp = this.newTransporter(agt, ch);
                let protoHnd = ProtocolHandlerStore.getStore(this.protocol(), false, agt.agentId).rent();
                wsip.initWarp(ch, agt, tp, this, protoHnd);
                tp.init(agt.nonBlockingHandler, ch, new WarpDataListener(wsip));
                BayLog.debug("%s init warp ship", wsip);
                needConnect = true;
            }

            this.tourList.push(tour);

            wsip.startWarpTour(tour);

            if(needConnect) {
                //agt.nonBlockingHandler.addChannelListener(wsip.ch, tp)
                agt.nonBlockingHandler.askToConnect(wsip.ch, this.hostAddr, this.port);
            }

        }
        catch(e) {
            BayLog.error_e(e);
            throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, e);
        }
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    keepShip(wsip: WarpShip): void {
        BayLog.trace("%s keep warp ship: %s", this, wsip);
        this.getShipStore(wsip.agent.agentId).keep(wsip);
    }

    returnShip(wsip: WarpShip): void {
        BayLog.debug("%s return warp ship: %s", this, wsip);
        this.getShipStore(wsip.agent.agentId).Return(wsip);
    }

    returnProtocolHandler(agt: GrandAgent, protoHnd: ProtocolHandler<any, any>) {
        BayLog.debug("%s Return protocol handler: %s", agt, protoHnd);
        this.getProtocolHandlerStore(agt.agentId).Return(protoHnd);
    }

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