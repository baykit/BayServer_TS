import {Letter} from "./letter";
import {Rudder} from "../../rudder/rudder";
import {Multiplexer} from "../../common/multiplexer";

export class ReadLetter extends Letter {
    nBytes: number
    address: string

    constructor(stateId: number, rd: Rudder, mpx: Multiplexer, n: number, adr: string) {
        super(stateId, rd, mpx)
        this.nBytes = n
        this.address = adr
    }
}
