import {Rudder} from "../../rudder/rudder";
import {Transporter} from "./transporter";
import {Multiplexer} from "../../common/multiplexer";
import {WriteUnit} from "./writeUnit";

export class RudderState {
    readonly rudder: Rudder
    readonly transporter: Transporter
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


    constructor(rd: Rudder, tp: Transporter = null, timeoutSec: number = 0) {
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