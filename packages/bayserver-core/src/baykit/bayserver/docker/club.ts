import {Tour} from "../tour/tour";
import {Docker} from "./docker";

export interface Club extends Docker {

    /**
     * Get the file name part of club
     * @return
     */
    getFileName(): string;

    /**
     * Get the ext (file extension part) of club
     * @return
     */
    getExtension(): string;

    /**
     * Check if file name matches this club
     * @param fname
     * @return
     */
    matches(fname: string): boolean;

    /**
     * Get charset of club
     * @return
     */
    getCharset(): string;

    /**
     * Check if this club decodes PATH_INFO
     * @return
     */
    getrDecodePathInfo(): boolean;

    /**
     * Arrive
     */
    arrive(tour: Tour);

}
