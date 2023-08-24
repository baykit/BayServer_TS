import {DataListener} from "../../agent/transporter/dataListener";
import {InboundShip} from "./inboundShip";
import {BayServer} from "../../bayserver";
import {BayLog} from "../../bayLog";
import {ProtocolException} from "../../protocol/protocolException";
import {InboundHandler} from "./inboundHandler";
import * as net from "net";
import {NextSocketAction} from "../../agent/nextSocketAction";

export class InboundDataListener implements DataListener{

    readonly ship: InboundShip;

    constructor(ship: InboundShip) {
        this.ship = ship
    }

    toString(): string {
        return this.ship.toString()
    }


    //////////////////////////////////////////////////////
    // Implements DataListener
    //////////////////////////////////////////////////////

    checkTimeout(durationSec: number): boolean {
        var timeout: boolean;
        if(this.ship.socketTimeoutSec <= 0)
            timeout = false;
        else if(this.ship.keeping)
            timeout = durationSec >= BayServer.harbor.getKeepTimeoutSec();
        else
            timeout = durationSec >= this.ship.socketTimeoutSec;

        BayLog.debug("%s Check timeout: dur=%d, timeout=%b, keeping=%b limit=%d keeplim=%d",
            this, durationSec, timeout, this.ship.keeping, this.ship.socketTimeoutSec, BayServer.harbor.getKeepTimeoutSec());
        return timeout;
    }

    notifyConnect(): number {
        throw new Error();
    }

    notifyRead(buf: Buffer, adr: net.SocketAddress): number {
        return this.ship.protocolHandler.bytesReceived(buf)
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s error detected: %s", this, err.message);
    }

    notifyEof(): number {
        BayLog.debug("%s EOF detected", this);
        return NextSocketAction.CLOSE;
    }

    notifyHandshakeDone(protocol: string): number {
        return 0;
    }

    notifyProtocolError(e: ProtocolException): boolean {
        BayLog.debug_e(e, "%s Protocol error: %s", this, e.message);
        return (this.ship.protocolHandler as Object as InboundHandler).sendReqProtocolError(e);
    }

    notifyClose() {
        BayLog.debug("%s notifyClose", this);

        this.ship.abortTours();

        if(this.ship.activeTours.length > 0) {
            // cannot close because there are some running tours
            BayLog.debug(this + " cannot end ship because there are some running tours (ignore)");
            this.ship.needEnd = true;
        }
        else {
            this.ship.endShip();
        }
    }

}