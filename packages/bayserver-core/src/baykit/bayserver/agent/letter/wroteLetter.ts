import {RudderState} from "../multiplexer/rudderState";
import {Letter} from "./letter";

export class WroteLetter extends Letter {
    nBytes: number

    constructor(st: RudderState, n: number) {
        super(st)
        this.nBytes = n
    }
}