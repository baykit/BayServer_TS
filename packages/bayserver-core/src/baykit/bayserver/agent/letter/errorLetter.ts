import {Letter} from "./letter";
import {Rudder} from "../../rudder/rudder";
import {Multiplexer} from "../../common/multiplexer";

export class ErrorLetter extends Letter {
    err: Error

    constructor(rd: Rudder, mpx: Multiplexer, e: Error) {
        super(rd, mpx)
        this.err = e;
    }
}
