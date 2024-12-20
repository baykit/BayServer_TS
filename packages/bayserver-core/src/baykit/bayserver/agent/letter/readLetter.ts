import {RudderState} from "../multiplexer/rudderState";
import {Letter} from "./letter";

export class ReadLetter extends Letter {
    nBytes: number
    address: string

    constructor(st: RudderState, n: number, adr: string) {
        super(st)
        this.nBytes = n
        this.address = adr
    }
}