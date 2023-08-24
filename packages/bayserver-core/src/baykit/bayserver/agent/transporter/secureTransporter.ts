import {Transporter} from "./transporter";
import {NonBlockingHandler} from "../nonBlockingHandler";
import {DataListener} from "./dataListener";
import {ChannelWrapper} from "../channelWrapper";

export class SecureTransporter extends Transporter{
    readonly ctx: Object

    constructor(ctx: Object, serverMode: boolean, traceSSL: boolean) {
        super(serverMode, traceSSL)
        this.ctx = ctx
    }

    //////////////////////////////////////////////////////
    // Overrides Transporter
    //////////////////////////////////////////////////////

    init(chHnd: NonBlockingHandler, ch: ChannelWrapper, lis: DataListener) {
        super.init(chHnd, ch, lis);
    }


    reset(): void {
        super.reset()
    }

    toString(): string {
        return "stp[" + this.dataListener + "]";
    }


    //////////////////////////////////////////////////////
    // Implements Transporter
    //////////////////////////////////////////////////////

    protected secure(): boolean {
        return true;
    }
}