import {DataListener} from "../agent/transporter/dataListener";
import {Counter} from "../util/counter";
import {Sink} from "../sink";
import {ProtocolException} from "../protocol/protocolException";

/**
 * Boat wraps output stream
 */
export abstract class Boat implements DataListener {

    static readonly INVALID_BOAT_ID: number = 0
    private static oidCounter: Counter
    private static idCounter: Counter

    readonly objectId: number = 0
    boatId: number = 0

    constructor() {
        this.objectId = Boat.oidCounter.next()
        this.boatId = Boat.INVALID_BOAT_ID
    }

    init(): void {
        this.boatId = Boat.idCounter.next()
    }

    notifyConnect(): number {
        throw new Sink();
    }

    notifyRead(buf: Buffer, adr): number {
        throw new Sink();
    }

    notifyEof(): number {
        throw new Sink();
    }

    abstract notifyError(err: Error): void;

    notifyHandshakeDone(protocol: string): number {
        throw new Sink();
    }

    notifyProtocolError(e: ProtocolException): boolean {
        throw new Sink();
    }

    abstract notifyClose(): void;

    checkTimeout(durationSec: number): boolean {
        throw new Sink();
    }

    static initClass() {
        this.oidCounter = new Counter()
        this.idCounter = new Counter()
    }
}


Boat.initClass()