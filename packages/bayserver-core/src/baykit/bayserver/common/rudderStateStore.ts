import {BayLog} from "../bayLog";
import {GrandAgent} from "../agent/grandAgent";
import {LifeCycleListener} from "../agent/lifeCycleListener";
import {ObjectStore} from "../util/objectStore";
import {StrUtil} from "../util/strUtil";
import {RudderState} from "../agent/multiplexer/rudderState";


class AgentListener implements LifeCycleListener {

    add(agentId: number) {
        while(RudderStateStore.stores.length < agentId)
            RudderStateStore.stores.push(null)
        RudderStateStore.stores[agentId - 1] = new RudderStateStore()
    }

    remove(agentId: number): void {
        RudderStateStore.stores[agentId - 1] = null
    }
}


export class RudderStateStore extends ObjectStore<RudderState> {

    /** stores[agentId - 1] => RudderStateStore */
    static stores: RudderStateStore[] = []

    constructor() {
        super(() => new RudderState());
    }

    printUsage(indent: number): void {
        BayLog.info("%sRudderStateStore Usage:", StrUtil.indent(indent));
        super.printUsage(indent + 1);
    }

    static init(): void {
        GrandAgent.addLifecycleListener(new AgentListener());
    }

    static getStore(agentId: number): RudderStateStore {
        return this.stores[agentId - 1];
    }
}
