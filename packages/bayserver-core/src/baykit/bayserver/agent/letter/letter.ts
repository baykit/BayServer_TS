import {Rudder} from "../../rudder/rudder";
import {Multiplexer} from "../../common/multiplexer";

export abstract class Letter {
    readonly stateId: number
    readonly rudder: Rudder
    readonly multiplexer: Multiplexer

    protected constructor(stateId: number, rd: Rudder, mpx: Multiplexer) {
        this.stateId = stateId
        this.rudder = rd
        this.multiplexer = mpx
    }
}
