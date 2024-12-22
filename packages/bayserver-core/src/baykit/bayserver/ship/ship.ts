import {Reusable} from "../util/Reusable";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {Counter} from "../util/counter";
import {Rudder} from "../rudder/rudder";
import {Transporter} from "../agent/multiplexer/transporter";
import {ProtocolException} from "../protocol/protocolException";

export abstract class Ship implements Reusable{

    static readonly SHIP_ID_NOCHECK: number = -1;
    static readonly INVALID_SHIP_ID: number = 0;

    static readonly oidCounter: Counter = new Counter(1);
    static readonly idCounter: Counter = new Counter(1);

    readonly objectId: number;
    shipId: number;
    agentId: number;
    rudder: Rudder;
    transporter: Transporter
    initialized: boolean = false;
    keeping: boolean = false;

    constructor() {
        this.objectId = Ship.oidCounter.next();
        this.shipId = Ship.INVALID_SHIP_ID;
    }

    public init(agtId: number, rd: Rudder, tp: Transporter) {
        if(this.initialized)
            throw new Sink("Ship already initialized");
        this.shipId = Ship.idCounter.next();
        this.agentId = agtId
        this.rudder = rd
        this.transporter = tp
        this.initialized = true;
        BayLog.debug("%s Initialized", this);
    }

    reset(): void {
        //BayLog.debug("%s reset", this);
        this.initialized = false;
        this.transporter = null
        this.rudder = null
        this.agentId = -1
        this.shipId = Ship.INVALID_SHIP_ID;
        this.keeping = false;
    }

    id(): number {
        return this.shipId;
    }

    /*
    protocol(): string {
        return this.protocolHandler == null ? "unknown" : this.protocolHandler.protocol();
    }

     */

    checkShipId(shipId: number): void {
        if(!this.initialized) {
            throw new Sink(this + " Uninitialized ship (might be returned ship): " + shipId);
        }
        if(shipId == 0 || (shipId != Ship.SHIP_ID_NOCHECK && shipId != this.shipId)) {
            throw new Sink(this + " Invalid ship id (might be returned ship): " + shipId);
        }
    }

    resumeRead(checkId: number): void {
        this.checkShipId(checkId);
        this.transporter.reqRead(this.rudder);
    }

    postClose(): void {
        this.transporter.reqClose(this.rudder)
    }

    //////////////////////////////////////////////////////
    // Abstract methods
    //////////////////////////////////////////////////////
    abstract notifyHandshakeDone(protocol: string): number;
    abstract notifyConnect(): number;
    abstract notifyRead(buf: Buffer): number;
    abstract notifyEof(): number;
    abstract notifyError(err: Error): void;
    abstract notifyProtocolError(e: ProtocolException): boolean;
    abstract notifyClose(): void;
    abstract checkTimeout(durationSec: number): boolean;
}