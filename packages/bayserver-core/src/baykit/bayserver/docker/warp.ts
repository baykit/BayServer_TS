import {Docker} from "./docker";
import {Ship} from "../ship/ship";

export interface Warp extends Docker {
    getHost(): string
    getPort(): number
    getWarpBase(): string
    getTimeoutSec(): number
    keep(warpShip: Ship): void
    onEndShip(warpShip: Ship): void
}