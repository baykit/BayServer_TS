import {PlainTransporter} from "./plainTransporter";
import {Multiplexer} from "../../common/multiplexer";
import {Ship} from "../../ship/ship";
import {SocketRudder} from "../../rudder/socketRudder";
import {Rudder} from "../../rudder/rudder";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {Sink} from "../../sink";

export class SecureTransporter extends PlainTransporter {
    readonly ctx: Object
    readonly appProtocols: String[]

    constructor(mpx: Multiplexer, sip: Ship, serverMode: boolean, readBufferSize: number, traceSSL: boolean, ctx: Object, protos: String[]) {
        super(mpx, sip, serverMode, readBufferSize, traceSSL)
        this.ctx = ctx
        this.appProtocols = protos
    }

    init() {
        super.init();
        this.readBufferSize = (this.ship.rudder as SocketRudder).socket().readableHighWaterMark
    }

    toString(): string {
        return "stp[" + this.ship + "]";
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////


    reset(): void {
        super.reset()
    }


    //////////////////////////////////////////////////////
    // Implements Transporter
    //////////////////////////////////////////////////////

    reqTransfer(rd: Rudder, fileRd: Rudder, ofs: number, len: number, listener: DataConsumeListener): void {
        throw new Sink()
    }

    protected secure(): boolean {
        return true;
    }


}