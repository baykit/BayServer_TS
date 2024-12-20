import {Letter} from "./letter";
import {RudderState} from "../multiplexer/rudderState";

export class ClosedLetter extends Letter {

    constructor(st: RudderState) {
        super(st)
    }
}