import {Tour} from "../tour/tour";
import {Rudder} from "../rudder/rudder";

export interface Permission {

    socketAdmitted(rd: Rudder): void

    tourAdmitted(tour: Tour): void
}