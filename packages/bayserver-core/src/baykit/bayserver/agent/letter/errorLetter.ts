import {Letter} from "./letter";
import {Rudder} from "../../rudder/rudder";
import {Multiplexer} from "../../common/multiplexer";

export class ErrorLetter extends Letter {
    err: Error

    constructor(stateId: number, rd: Rudder, mpx: Multiplexer, e: Error) {
        super(stateId, rd, mpx)
        this.err = e;
    }
}
