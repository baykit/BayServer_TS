import {Letter} from "./letter";
import {Rudder} from "../../rudder/rudder";
import {Multiplexer} from "../../common/multiplexer";

export class WroteLetter extends Letter {
    nBytes: number

    constructor(rd: Rudder, mpx: Multiplexer, n: number) {
        super(rd, mpx)
        this.nBytes = n
    }
}
