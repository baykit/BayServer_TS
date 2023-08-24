import {ObjectStore} from "../util/objectStore";
import {ProtocolHandler} from "./protocolHandler";
import {PacketStore} from "./packetStore";
import {ProtocolHandlerFactory} from "./protocolHandlerFactory";
import {BayLog} from "../bayLog";
import {StrUtil} from "../util/strUtil";
import {Packet} from "./packet";
import {Command} from "./command";
import {LifeCycleListener} from "../agent/lifeCycleListener";
import {GrandAgent} from "../agent/grandAgent";


class AgentListener implements LifeCycleListener {

    add(agentId: number) {
        for(const info of ProtocolHandlerStore.protoMap.values()) {
            info.addAgent(agentId)
        }
    }

    remove(agentId: number): void {
        for(const info of Object.values(ProtocolHandlerStore.protoMap)) {
            info.removeAgent(agentId)
        }
    }
}

class ProtocolInfo<C extends Command<C, P, any>, P extends Packet> {
    readonly protocol: string;
    readonly serverMode: boolean;
    readonly protocolHandlerFactory: ProtocolHandlerFactory<any, any>;

    /** Agent ID => ProtocolHandlerStore */
    readonly stores: Map<number, ProtocolHandlerStore<C, P>> = null

    public constructor(proto: string, svrMode: boolean, protocolHandlerFactory: ProtocolHandlerFactory<C, P>) {
        this.protocol = proto;
        this.serverMode = svrMode
        this.protocolHandlerFactory = protocolHandlerFactory;
        this.stores = new Map()
    }

    addAgent(agtId: number): void {
       let store: PacketStore<P> = PacketStore.getStore(this.protocol, agtId);
       this.stores.set(agtId, new ProtocolHandlerStore(this.protocol, this.serverMode, this.protocolHandlerFactory, store))
    }

    removeAgent(agtId: number): void {
        this.stores.delete(agtId)
    }
}

export class ProtocolHandlerStore<C extends Command<C, P, any>, P extends Packet>
    extends ObjectStore<ProtocolHandler<C, P>> {

    static protoMap: Map<string, ProtocolInfo<any, any>> = null

    protocol: string;
    serverMode: boolean;

    constructor(
        protocol: string,
        svrMode: boolean,
        phFactory: ProtocolHandlerFactory<C, P>,
        pktStore: PacketStore<P>) {

        super()
        this.protocol = protocol;
        this.serverMode = svrMode
        this.factory = () => {
            return phFactory.createProtocolHandler(pktStore);
        };
    }

    /**
     * print memory usage
     */
    printUsage(indent: number): void {
        BayLog.info("%sProtocolHandlerStore(%s%s) Usage:", StrUtil.indent(indent), this.protocol, this.serverMode ? "s" : "c");
        super.printUsage(indent+1);
    }

    static init() {
        GrandAgent.addLifecycleListener(new AgentListener())
    }

    static getStore(
        proto: string,
        svrMode: boolean,
        agentId: number) : ProtocolHandlerStore<any, any> {

        return this.protoMap.get(this.getProtocolForm(proto, svrMode)).stores.get(agentId)
    }

    static getStores(agentId: number) {
        let storeList: ProtocolHandlerStore<any, any>[] = []
        for(const info of this.protoMap.values()) {
            storeList.push(info.stores.get(agentId))
        };
        return storeList;
    }

    static registerProtocol(
        protocol: string,
        svrMode: boolean,
        pHndFactory: ProtocolHandlerFactory<any, any>) {

        let protoForm = this.getProtocolForm(protocol, svrMode)
        if(!(protoForm in this.protoMap)) {
            this.protoMap.set(protoForm, new ProtocolInfo(protocol, svrMode, pHndFactory))
        }
    }

    static getProtocolForm(protocol: string, svrMode: boolean): string{
        if(svrMode)
            return protocol + "-s";
        else
            return protocol + "-c";
    }

    static initClass() {
        this.protoMap = new Map()
    }
}

ProtocolHandlerStore.initClass()