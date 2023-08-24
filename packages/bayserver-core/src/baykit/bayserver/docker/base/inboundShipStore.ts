import {ObjectStore} from "../../util/objectStore";
import {InboundShip} from "./inboundShip";
import {BayLog} from "../../bayLog";
import {StrUtil} from "../../util/strUtil";
import {LifeCycleListener} from "../../agent/lifeCycleListener";
import {GrandAgent} from "../../agent/grandAgent";


class AgentListener implements LifeCycleListener {

    add(agentId: number) {
        InboundShipStore.stores[agentId] = new InboundShipStore()
    }

    remove(agentId: number): void {
        delete InboundShipStore.stores[agentId]
    }
}


export class InboundShipStore extends ObjectStore<InboundShip> {

    /** Agent id => InboundShipStore */
    static stores: {[key: number]: InboundShipStore} = {}

    constructor() {
        super(() => new InboundShip());
    }

    /**
     *  print memory usage
     */
    public printUsage(indent: number): void
    {
        BayLog.info("%sInboundShipStore Usage:", StrUtil.indent(indent));
        super.printUsage(indent + 1);
    }

    static init(): void {
        GrandAgent.addLifecycleListener(new AgentListener());
    }

    static getStore(agentId: number): InboundShipStore {
        return this.stores[agentId];
    }
}