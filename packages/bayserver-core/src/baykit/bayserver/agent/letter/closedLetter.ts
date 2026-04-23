import {Letter} from "./letter";
import {Rudder} from "../../rudder/rudder";
import {Multiplexer} from "../../common/multiplexer";

export class ClosedLetter extends Letter {

    constructor(rd: Rudder, mpx: Multiplexer) {
        super(rd, mpx)
    }
}
