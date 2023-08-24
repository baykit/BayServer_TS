import {Reusable} from "../util/Reusable";
import {Postman} from "../util/postman";
import {GrandAgent} from "../agent/grandAgent";
import * as net from "net";
import {ProtocolHandler} from "../protocol/protocolHandler";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {Counter} from "../util/counter";
import {ChannelWrapper} from "../agent/channelWrapper";

export abstract class Ship implements Reusable{

    static readonly SHIP_ID_NOCHECK: number = -1;
    static readonly INVALID_SHIP_ID: number = 0;

    static readonly oidCounter: Counter = new Counter(1);
    static readonly idCounter: Counter = new Counter(1);

    readonly objectId: number;
    shipId: number;
    agent: GrandAgent;
    postman: Postman;
    ch: ChannelWrapper;
    protocolHandler: ProtocolHandler<any, any>;
    initialized: boolean;
    keeping: boolean;

    constructor() {
        this.objectId = Ship.oidCounter.next();
        this.shipId = Ship.INVALID_SHIP_ID;
    }

    public init(ch: ChannelWrapper, agent: GrandAgent, pm: Postman) {
        if(this.initialized)
            throw new Sink("Ship already initialized");
        this.shipId = Ship.idCounter.next();
        this.agent = agent;
        this.postman = pm;
        this.ch = ch;
        this.initialized = true;
        BayLog.debug("%s Initialized", this);
    }

    reset(): void {
        //BayLog.debug("%s reset", this);
        this.initialized = false;
        this.postman.reset();
        this.postman = null;  // for reloading certification
        this.protocolHandler = null;
        this.agent = null;
        this.shipId = Ship.INVALID_SHIP_ID;
        this.ch = null;
        this.keeping = false;
    }

    setProtocolHandler(protoHandler: ProtocolHandler<any, any>): void {
        this.protocolHandler = protoHandler;
        protoHandler.ship = this;
        BayLog.debug("%s protocol handler is set", this);
    }

    id(): number {
        return this.shipId;
    }

    protocol(): string {
        return this.protocolHandler == null ? "unknown" : this.protocolHandler.protocol();
    }

    resume(checkId: number): void {
        this.checkShipId(checkId);
        this.postman.openValve();
    }

    checkShipId(shipId: number): void {
        if(!this.initialized) {
            throw new Sink(this + " Uninitialized ship (might be returned ship): " + shipId);
        }
        if(shipId == 0 || (shipId != Ship.SHIP_ID_NOCHECK && shipId != this.shipId)) {
            throw new Sink(this + " Invalid ship id (might be returned ship): " + shipId);
        }
    }
}