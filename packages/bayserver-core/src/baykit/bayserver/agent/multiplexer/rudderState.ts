import {Rudder} from "../../rudder/rudder";
import {Transporter} from "./transporter";
import {Multiplexer} from "../../common/multiplexer";
import {WriteUnit} from "./writeUnit";
import {Reusable} from "../../util/Reusable";

export class RudderState implements Reusable {
    rudder: Rudder
    transporter: Transporter
    multiplexer: Multiplexer

    lastAccessTime: number
    closing: boolean = false
    readBuf: Buffer
    writeQueue: WriteUnit[] = []

    reading: boolean = false
    writing: boolean = false

    bytesRead: number = 0
    bytesWrote: number = 0
    closed: boolean = false
    finale: boolean = false
    timeoutSec: number = 0


    constructor() {
    }

    init(rd: Rudder, tp: Transporter = null, timeoutSec: number = 0): void {
        if (rd == null)
            throw new Error("nullPo");
        this.rudder = rd
        this.transporter = tp
        this.closed = false
        this.timeoutSec = timeoutSec
        if (tp != null) {
            this.readBuf = Buffer.alloc(tp.getReadBufferSize())
        }
        else {
            this.readBuf = Buffer.alloc(8192)
        }
    }

    reset(): void {
        this.rudder = null
        this.transporter = null
        this.multiplexer = null
        this.lastAccessTime = undefined
        this.closing = false
        this.readBuf = null
        this.writeQueue = []
        this.reading = false
        this.writing = false
        this.bytesRead = 0
        this.bytesWrote = 0
        this.closed = false
        this.finale = false
        this.timeoutSec = 0
    }

    toString(): string {
        let s = "st(rd=" + this.rudder + " mpx=" + this.multiplexer + " tp=" + this.transporter + ")"

        if(this.closing)
            s += " closing"

        return s
    }

    access(): void {
        this.lastAccessTime = Date.now()
    }

}
