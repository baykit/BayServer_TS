import {Tour} from "../tour/tour";

export interface Permission {

    socketAdmitted(ch);

    tourAdmitted(tour: Tour)
}