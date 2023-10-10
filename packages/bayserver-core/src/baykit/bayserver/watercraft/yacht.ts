import {Counter} from "../util/counter";
import {DataListener} from "../agent/transporter/dataListener";
import {Reusable} from "../util/Reusable";
import {ProtocolException} from "../protocol/protocolException";
import {Sink} from "../sink";

export abstract class Yacht implements DataListener, Reusable{
    static readonly INVALID_YACHT_ID: number = 0;
    static oidCounter: Counter = new Counter();
    static idCounter: Counter = new Counter();

    public readonly objectId: number;
    public yachtId: number;

    constructor() {
        this.objectId = Yacht.oidCounter.next();
        this.yachtId = Yacht.INVALID_YACHT_ID;
    }

    initYacht() {
        this.yachtId = Yacht.idCounter.next();
    }

    //////////////////////////////////////////////////////
    // Implements DataListener
    //////////////////////////////////////////////////////
    notifyConnect(): number {
        throw new Sink()
    }

    notifyHandshakeDone(protocol: string): number {
        throw new Sink()
    }

    notifyProtocolError(e: ProtocolException): boolean {
        throw new Sink()
    }

    checkTimeout(durationSec: number): boolean {
        return false
    }

    abstract notifyClose()
    abstract notifyEof(): number
    abstract notifyError(err: Error): void
    abstract notifyRead(buf: Buffer, adr): number

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////
    abstract reset()
}