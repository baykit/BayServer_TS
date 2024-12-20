import {RudderState} from "../multiplexer/rudderState";

export abstract class Letter {
    state: RudderState

    protected constructor(state: RudderState) {
        this.state = state;
    }
}