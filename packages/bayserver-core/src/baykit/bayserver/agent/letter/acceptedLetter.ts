import {Rudder} from "../../rudder/rudder";
import {RudderState} from "../multiplexer/rudderState";
import {Letter} from "./letter";

export class AcceptedLetter extends Letter {
    clientRudder: Rudder

    constructor(st: RudderState, rd: Rudder) {
        super(st)
        this.clientRudder = rd;
    }
}