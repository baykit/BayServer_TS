import {Transporter} from "./transporter";
import {Buffer} from "buffer";
import {Multiplexer} from "../../common/multiplexer";
import {Ship} from "../../ship/ship";
import {Rudder} from "../../rudder/rudder";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {BayLog} from "../../bayLog";
import {UpgradeException} from "../upgradeException";
import {ProtocolException} from "../../protocol/protocolException";
import {NextSocketAction} from "../nextSocketAction";
import {IOException} from "../../util/ioException";

export class PlainTransporter implements Transporter {

    protected readonly multiplexer: Multiplexer
    protected readonly serverMode: boolean = false;
    protected readonly traceSSL: boolean = false;
    protected readBufferSize: number
    protected needHandshake: boolean = true;
    protected ship: Ship
    protected closed: boolean = false

    protected secure(): boolean {
        return false;
    }


    constructor(multiplexer: Multiplexer, ship: Ship, serverMode: boolean, readBufferSize: number, traceSSL: boolean) {
        this.multiplexer = multiplexer;
        this.ship = ship;
        this.serverMode = serverMode;
        this.traceSSL = traceSSL;
        this.readBufferSize = readBufferSize;
    }

    toString(): string {
        return "tp[" + this.ship + "]"
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset() {
        this.closed = false
    }

    //////////////////////////////////////////////////////
    // Implements Transporter
    //////////////////////////////////////////////////////

    init(): void {
    }

    onConnect(rd: Rudder): number {
        BayLog.trace("%s onConnect", this);

        return this.ship.notifyConnect();
    }

    onRead(rd: Rudder, data: Buffer, adr: string): number {
        BayLog.debug("%s onRead", this);

        if(data == null || data.length == 0) {
            return this.ship.notifyEof();
        }
        else {
            try {
                return this.ship.notifyRead(data);
            }
            catch(e) {
                if(e instanceof UpgradeException) {
                    BayLog.debug("%s Protocol upgrade", this.ship);
                    return this.ship.notifyRead(data);
                }
                else if (e instanceof ProtocolException) {
                    let close: boolean = this.ship.notifyProtocolError(e);
                    if(!close && this.serverMode)
                        return NextSocketAction.CONTINUE;
                    else
                        return NextSocketAction.CLOSE;
                }
                else if (e instanceof IOException) {
                    // IOException which occur in notifyRead must be distinguished from
                    // IOException which occur in handshake or readNonBlock.
                    this.onError(rd, e)
                    return NextSocketAction.CLOSE
                }
                else {
                    throw e
                }
            }
        }

    }

    onError(rd: Rudder, e: Error): void {
        this.ship.notifyError(e)
    }

    onClosed(rd: Rudder): void {
        this.ship.notifyClose()
    }

    reqConnect(rd: Rudder, addr: string, port: number): void {
        this.multiplexer.reqConnect(rd, addr, port)
    }

    reqRead(rd: Rudder): void {
        this.multiplexer.reqRead(rd)
    }

    reqWrite(rd: Rudder, buf: Buffer, adr: string, tag: Object, listener: DataConsumeListener): void {
        this.multiplexer.reqWrite(rd, buf, adr, tag, listener)
    }

    reqClose(rd: Rudder): void {
        this.closed = true
        this.multiplexer.reqClose(rd)
    }

    checkTimeout(rd: Rudder, durationSec: number): boolean {
        return this.ship.checkTimeout(durationSec);
    }

    getReadBufferSize(): number {
        return this.readBufferSize;
    }

    printUsage(indent: number): void {
    }

}