import {Tour} from "../../tour/tour";

export abstract class LogItem {
    /**
     * initialize
     */
    init(param: string): void {

    }

    /**
     * Print log
     */
    abstract getItem(tour: Tour): string
}