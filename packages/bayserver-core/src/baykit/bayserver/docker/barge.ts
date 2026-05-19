import {Tour} from "../tour/tour";
import {Rudder} from "../rudder/rudder";
import {HttpHeaders} from "../util/httpHeaders";

/**
 * "Barge" is a metaphor for the cache management function.
 */
export interface Barge {

    /**
     * Barge name (path)
     */
    getName(): string;

    /**
     * Capacity of the barge. (in mega-bytes)
     */
    getCapacity(): number;

    /**
     * Get cargo on the barge.
     */
    getCargo(tour: Tour): [Barge.Cargo, Rudder];
}

export namespace Barge {

    /**
     * "Cargo" is a metaphor for cached data.
     */
    export interface Cargo {

        getPath(): string;
        getHeaders(): HttpHeaders;

        getContent(): Buffer;
        getLength(): number;

        isOnBarge(): boolean;
        isExceeded(): boolean;

        saveHeaders(headers: HttpHeaders): void;
        saveContent(bytes: Buffer, offset: number, len: number): void;
        endSave(): void;

        releaseRudder(rudder: Rudder): void;
    }
}
