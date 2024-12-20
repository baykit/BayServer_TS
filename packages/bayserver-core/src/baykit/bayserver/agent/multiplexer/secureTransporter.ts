import {PlainTransporter} from "./plainTransporter";
import {Multiplexer} from "../../common/multiplexer";
import {Ship} from "../../ship/ship";
import {SocketRudder} from "../../rudder/socketRudder";

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

    protected secure(): boolean {
        return true;
    }


}