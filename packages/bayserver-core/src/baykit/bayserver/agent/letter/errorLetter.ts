import {RudderState} from "../multiplexer/rudderState";
import {Letter} from "./letter";

export class ErrorLetter extends Letter {
    err: Error

    constructor(st: RudderState, e: Error) {
        super(st)
        this.err = e;
    }
}