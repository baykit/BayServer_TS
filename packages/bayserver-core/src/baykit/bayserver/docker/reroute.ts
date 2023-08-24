import {Town} from "./town";

export interface Reroute {
    reroute(twn: Town, uri: string): string;
}