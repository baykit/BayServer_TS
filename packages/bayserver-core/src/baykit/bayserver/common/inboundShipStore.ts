import {ObjectStore} from "../util/objectStore";
import {InboundShip} from "./inboundShip";
import {BayLog} from "../bayLog";
import {StrUtil} from "../util/strUtil";
import {LifeCycleListener} from "../agent/lifeCycleListener";
import {GrandAgent} from "../agent/grandAgent";


class AgentListener implements LifeCycleListener {

    add(agentId: number) {
        while(InboundShipStore.stores.length < agentId)
            InboundShipStore.stores.push(null)
        InboundShipStore.stores[agentId - 1] = new InboundShipStore()
    }

    remove(agentId: number): void {
        InboundShipStore.stores[agentId - 1] = null
    }
}


export class InboundShipStore extends ObjectStore<InboundShip> {

    /** stores[agentId - 1] => InboundShipStore */
    static stores: InboundShipStore[] = []

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
        return this.stores[agentId - 1];
    }
}