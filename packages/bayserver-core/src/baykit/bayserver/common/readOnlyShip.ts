import {Ship} from "../ship/ship";
import {Sink} from "../sink";
import {ProtocolException} from "../protocol/protocolException";
import {BayLog} from "../bayLog";
import {Rudder} from "../rudder/rudder";
import {Transporter} from "../agent/multiplexer/transporter";
import {Tour} from "../tour/tour";

export abstract class ReadOnlyShip extends Ship {

    init(agtId: number, rd: Rudder, tp : Transporter): void {
        super.init(agtId, rd, tp)
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
        super.reset()
    }


    //////////////////////////////////////////////////////
    // Implements Ship
    //////////////////////////////////////////////////////

    notifyHandshakeDone(protocol: string): number {
        throw new Sink()
    }

    notifyConnect(): number {
        throw new Sink()
    }

    notifyProtocolError(e: ProtocolException): boolean {
        BayLog.error_e(e)
        throw new Sink()
    }

}