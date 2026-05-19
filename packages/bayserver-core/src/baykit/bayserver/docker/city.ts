import {Club} from "./club";
import {Town} from "./town";
import {Tour} from "../tour/tour";
import {Trouble} from "./trouble";
import {Barge} from "./barge";

export interface City {

    /**
     * City name (host name)
     * @return
     */
    getName(): string;

    /**
     * All clubs (not included in town) in this city
     * @return
     */
    getClubs(): Club[];


    /**
     * All towns in this city
     * @return
     */
    getTowns(): Town[];

    /**
     * Find barge by path
     */
    findBarge(path: string): Barge;

    /**
     * Enter city
     * @param tour
     */
    enter(tour: Tour);

    /**
     * Get trouble docker
     * @return
     */
    getTrouble(): Trouble;

    /**
     * Logging
     * @param tour
     */
    log(tour: Tour);
}
