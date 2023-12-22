import {Tour} from "./tour";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {StrUtil} from "../util/strUtil";
import {LifeCycleListener} from "../agent/lifeCycleListener";
import {GrandAgent} from "../agent/grandAgent";


class AgentListener implements LifeCycleListener {

    add(agentId: number) {
        TourStore.stores.set(agentId, new TourStore())
    }

    remove(agentId: number): void {
        TourStore.stores.delete(agentId)
    }
}

export class TourStore {

    static MAX_TOURS: number = 128;

    private freeTours: Tour[] = [];
    private activeTourMap: Map<BigInt, Tour>
    static maxCount: number;

    /** Agent ID => TourStore */
    static stores: Map<number, TourStore> = null

    constructor() {
        this.activeTourMap = new Map()
    }

    get(key: BigInt): Tour {
        return this.activeTourMap.get(key)
    }


    rent(key: BigInt, force: boolean): Tour {
        let tur = this.get(key);
        if(tur != null)
            throw new Sink("Tour is active: " + tur);

        if (this.freeTours.length > 0) {
            //BayLog.debug("rent: key=%d from free tours", key);
            tur = this.freeTours.pop()
        } else {
            if (!force && (this.activeTourMap.size >= TourStore.maxCount)) {
                BayLog.warn("Max tour count reached")
                return null;
            } else {
                tur = new Tour();
            }
        }

        this.activeTourMap.set(key, tur)
        return tur;
    }

    Return(key: BigInt) : void {
        if(!this.activeTourMap.has(key)){
            throw new Sink("Tour is not active key=: " + key);
        }
        //BayLog.debug("return: key=%d Active tour count: before=%d", key, activeTourMap.size());
        let tur = this.activeTourMap.get(key)
        this.activeTourMap.delete(key)
        //BayLog.debug("return: key=%d Active tour count: after=%d", key, activeTourMap.size());
        BayLog.debug("%s reset", tur)
        tur.reset();
        this.freeTours.push(tur);
    }

    /**
     * print memory usage
     */
    printUsage(indent: number) : void {
        BayLog.info("%sTour store usage:", StrUtil.indent(indent));
        BayLog.info("%sfreeList: %d", StrUtil.indent(indent+1), this.freeTours.length);
        BayLog.info("%sactiveList: %d", StrUtil.indent(indent+1), this.activeTourMap.size);
        if(BayLog.isDebug()) {
            for(const obj of this.activeTourMap.values()) {
                BayLog.debug("%s%s", StrUtil.indent(indent+1), obj)
            }
        }
    }

    static init(maxTourCount: number) {
        TourStore.maxCount = maxTourCount
        GrandAgent.addLifecycleListener(new AgentListener())
    }

    static getStore(agentId: number): TourStore {
        return this.stores.get(agentId)
    }

    static initClass() {
        this.stores = new Map()
    }
}

TourStore.initClass()