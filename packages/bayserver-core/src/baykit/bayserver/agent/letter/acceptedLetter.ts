import {Rudder} from "../../rudder/rudder";
import {Letter} from "./letter";
import {Multiplexer} from "../../common/multiplexer";

export class AcceptedLetter extends Letter {
    clientRudder: Rudder

    constructor(stateId: number, rd: Rudder, mpx: Multiplexer, clientRd: Rudder) {
        super(stateId, rd, mpx)
        this.clientRudder = clientRd;
    }
}
