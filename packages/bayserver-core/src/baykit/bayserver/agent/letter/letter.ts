import {Rudder} from "../../rudder/rudder";
import {Multiplexer} from "../../common/multiplexer";

export abstract class Letter {
    readonly rudder: Rudder
    readonly multiplexer: Multiplexer

    protected constructor(rd: Rudder, mpx: Multiplexer) {
        this.rudder = rd
        this.multiplexer = mpx
    }
}
