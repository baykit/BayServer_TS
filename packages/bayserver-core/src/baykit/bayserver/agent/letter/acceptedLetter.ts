import {Rudder} from "../../rudder/rudder";
import {Letter} from "./letter";
import {Multiplexer} from "../../common/multiplexer";

export class AcceptedLetter extends Letter {
    clientRudder: Rudder

    constructor(rd: Rudder, mpx: Multiplexer, clientRd: Rudder) {
        super(rd, mpx)
        this.clientRudder = clientRd;
    }
}
