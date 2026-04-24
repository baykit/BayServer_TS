import {Packet} from "./packet";
import {Reusable} from "../util/Reusable";
import {PacketFactory} from "./packetFactory";
import {ObjectStore} from "../util/objectStore";
import {BayLog} from "../bayLog";
import {StrUtil} from "../util/strUtil";
import {GrandAgent} from "../agent/grandAgent";
import {LifeCycleListener} from "../agent/lifeCycleListener";


class AgentListener implements LifeCycleListener {

    add(agentId: number) {
        for(const info of Object.values(PacketStore.protoMap)) {
            info.addAgent(agentId)
        }
    }

    remove(agentId: number): void {
        for(const info of Object.values(PacketStore.protoMap)) {
            info.removeAgent(agentId)
        }
    }
}


class ProtocolInfo<P extends Packet> {
    readonly protocol: string;
    readonly packetFactory: PacketFactory<P>;

    /** Agent ID => PacketStore */
    readonly stores: {[key: number]: PacketStore<P>} = {}

    public constructor(proto: string, packetFactory: PacketFactory<P>) {
        this.protocol = proto;
        this.packetFactory = packetFactory;
    }

    public newStore(): PacketStore<P> {
        return new PacketStore<P>(this.protocol, this.packetFactory);
    }

    addAgent(agtId: number): void {
        let store: PacketStore<P> = new PacketStore(this.protocol, this.packetFactory);
        this.stores[agtId] = store
    }

    removeAgent(agtId: number): void {
        delete this.stores[agtId];
    }
}

/**
 * Packet pool
 * @param <P> Packet
 */
export class PacketStore<P extends Packet> implements Reusable {

    static protoMap: {[key: string]: ProtocolInfo<any>} = {};

    readonly protocol: string;
    readonly storeMap: ObjectStore<P>[] = []
    readonly factory: PacketFactory<P>;

    constructor(protocol: string, factory: PacketFactory<P>) {
        this.protocol = protocol;
        this.factory = factory;
        for(let i = 0; i < 128; i++) {
            this.storeMap.push(null);
        }
    }

    reset(): void {
        for(const store of this.storeMap) {
            if(store != null)
                store.reset();
        }
    }

    rent(typ: number): P {
        var store: ObjectStore<P> = this.storeMap[typ];
        if(store == null) {
            store = new ObjectStore<P>(() => this.factory.createPacket(typ));
            this.storeMap[typ] = store;
        }

        return store.rent();
    }

    Return(pkt: P) : void {
        let store: ObjectStore<P> = this.storeMap[pkt.type];
        store.Return(pkt);
    }

    /**
     * print memory usage
     */
    printUsage(indent: number): void {
        BayLog.info("%sPacketStore(%s) usage nTypes=%d", StrUtil.indent(indent), this.protocol, this.storeMap.length);
        for(let i = 0; i < this.storeMap.length; i++) {
            if(this.storeMap[i] != null) {
                BayLog.info("%sType: %d", StrUtil.indent(indent+1), i);
                this.storeMap[i].printUsage(indent+2);
            }
        }
    }


    //////////////////////////////////////////////////////
    // Class methods
    //////////////////////////////////////////////////////

    static init(): void {
        GrandAgent.addLifecycleListener(new AgentListener());
    }

    static registerProtocol(
        protocol: string,
        pktFactory: PacketFactory<any>) {
        if(!(protocol in this.protoMap)) {
            this.protoMap[protocol] = new ProtocolInfo(protocol, pktFactory);
        }
    }

    static getStore(protocol: string, agtId: number) {
        return this.protoMap[protocol].stores[agtId];
    }

    static getStores(agentId: number): PacketStore<any>[] {
        let storeList: PacketStore<any>[] = [];
        for(const info of Object.values(this.protoMap)) {
            storeList.push(info.stores[agentId]);
        }
        return storeList;
    }
}
