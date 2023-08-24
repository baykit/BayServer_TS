import {City} from "./city";
import {Club} from "./club";
import {Tour} from "../tour/tour";
import exp = require("constants");
import {Docker} from "./docker";

export const MATCH_TYPE_MATCHED: number = 1;
export const MATCH_TYPE_NOT_MATCHED: number = 2;
export const MATCH_TYPE_CLOSE: number = 3;

export interface Town extends Docker {

    /**
     * Get the name (path) of this town
     * The name ends with "/"
     * @return
     */
    getName(): string;

    /**
     * Get city
     * @return
     */
    getCity(): City;

    /**
     * Get the physical location of this town
     * @return
     */
    getLocation(): string;

    /**
     * Get index file
     * @return
     */
    getWelcomeFile(): string;


    /**
     * All clubs in this town
     * @return club list
     */
    getClubs(): Club[];

    /**
     * Get rerouted uri
     * @return reroute list
     */
    reroute(uri: string): string;



    matches(uri: string): number;

    checkAdmitted(tour: Tour);

}