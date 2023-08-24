import {InboundShipStore} from "./docker/base/inboundShipStore";
import {ProtocolHandlerStore} from "./protocol/protocolHandlerStore";
import {PacketStore} from "./protocol/packetStore";
import {TourStore} from "./tour/tourStore";
import {BayServer} from "./bayserver";
import {Port} from "./docker/port";
import {City} from "./docker/city";
import {GrandAgent} from "./agent/grandAgent";
import {LifeCycleListener} from "./agent/lifeCycleListener";

class AgentListener implements LifeCycleListener {

    add(agentId: number) {
        MemUsage.memUsages.set(agentId, new MemUsage(agentId))
    }

    remove(agentId: number): void {
        MemUsage.memUsages.delete(agentId)
    }
}


export class MemUsage {

    /** Agent ID => MemUsage */
    static memUsages: Map<number, MemUsage>

    readonly agentId: number;

    constructor(id: number) {
        this.agentId = id
    }

    printUsage(indent: number): void {
        InboundShipStore.getStore(this.agentId).printUsage(indent + 1);
        for(const store of ProtocolHandlerStore.getStores(this.agentId)) {
            store.printUsage(indent + 1)
        }
        for(const store of PacketStore.getStores(this.agentId)) {
            store.printUsage(indent + 1)
        }
        TourStore.getStore(this.agentId).printUsage(indent + 1);
        for (const city of BayServer.cities.getCities()) {
            this.printCityUsage(null, city, indent)
        }
        ;
        for (const port of BayServer.ports) {
            for (const city of port.getCities()) {
                this.printCityUsage(port, city, indent)
            }
        }
    }

    static init(): void {
        this.memUsages = new Map()
        GrandAgent.addLifecycleListener(new AgentListener());
    }

    static get(id: number) {
        return this.memUsages.get(id)
    }


    private printCityUsage(port: Port, city: City, indent: number) {
        let pname = port == null ? "" : "@" + port;
        for(const club of city.getClubs()) {
            /*
            if (club instanceof WarpDocker) {
                BayLog.info("%sClub(%s%s) Usage:", StrUtil.indent(indent), club, pname);
                (club as WarpDocker).getShipStore(this.agentId).printUsage(indent+1);
            }
             */
        }
        for(const town of city.getTowns()) {
            for (const club of town.getClubs()) {
                /*
                if (club instanceof WarpDocker) {
                    BayLog.info("%sClub(%s%s) Usage:", StrUtil.indent(indent), club, pname);
                    (club as WarpDocker).getShipStore(this.agentId).printUsage(indent + 1);
                }

                 */
            }
        }
    }
}