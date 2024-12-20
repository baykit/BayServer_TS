import {Letter} from "./letter";
import {RudderState} from "../multiplexer/rudderState";
import {Rudder} from "../../rudder/rudder";

export class ConnectedLetter extends Letter {

    constructor(st: RudderState) {
        super(st)
    }
}