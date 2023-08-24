import {ObjectStore} from "../../util/objectStore";
import {WarpShip} from "./warpShip";
import {BayLog} from "../../bayLog";
import {ArrayUtil} from "../../util/arrayUtil";
import {Sink} from "../../sink";
import {StrUtil} from "../../util/strUtil";

export class WarpShipStore extends ObjectStore<WarpShip> {

    keepList: WarpShip[] = []
    busyList: WarpShip[] = []

    maxShips: number


    constructor(maxShips: number) {
        super();
        this.maxShips = maxShips;
        this.factory = () => new WarpShip()
    }

    rent(): WarpShip {
        if(this.maxShips > 0 && this.count() >= this.maxShips)
            return null;

        let wsip: WarpShip;
        if(ArrayUtil.empty(this.keepList)) {
            BayLog.trace("rent from Object Store");
            wsip = super.rent();
            if (wsip == null)
                return null;
        }
        else {
            BayLog.trace("rent from freeList: %s", this.keepList);
            wsip = this.keepList.pop()
        }
        if(wsip == null)
            throw new Sink("BUG! ship is null");
        if(wsip.postman != null && wsip.postman.isZombie())
            throw new Sink("BUG! channel is zombie: " + wsip);
        this.busyList.push(wsip);

        BayLog.trace("rent: keepList=%s busyList=%s", this.keepList, this.busyList);
        return wsip;
    }

    /**
     * Keep ship which connection is alive
     * @param wsip
     */
    keep(wsip: WarpShip): void {
        BayLog.trace("keep: before freeList=%s busyList=%s", this.keepList, this.busyList);

        if(!(ArrayUtil.valueIn(wsip, this.busyList)))
            BayLog.error("BUG: " + wsip + " not in busy list");
        ArrayUtil.remove(wsip, this.busyList)
        this.keepList.push(wsip);
        BayLog.trace("keep: after freeList=%s busyList=%s", this.keepList, this.busyList);
    }

    /**
     * Return ship which connection is closed
     * @param wsip
     */
    Return(wsip: WarpShip): void {
        BayLog.trace("Return: before keepList=%s busyList=%s", this.keepList, this.busyList);
        let removedFromFree = ArrayUtil.remove(wsip, this.keepList);
        let removedFromBusy = ArrayUtil.remove(wsip, this.busyList);
        if(!removedFromFree && !removedFromBusy)
        BayLog.error("BUG:" + wsip + " not in both free list and busy list");

        super.Return(wsip);
        BayLog.trace("Return: after keepList=%s busyList=%s", this.keepList, this.busyList);
    }

    count(): number {
        return this.keepList.length + this.busyList.length;
    }

    busyCount(): number {
        return this.busyList.length
    }

    /**
     * print memory usage
     */
    printUsage(indent: number): void {
        BayLog.info("%sWarpShipStore Usage:", StrUtil.indent(indent));
        BayLog.info("%skeepList: %d", StrUtil.indent(indent+1), this.keepList.length);
        if(BayLog.isDebug()) {
            for(const obj of this.keepList) {
                BayLog.debug("%s%s", StrUtil.indent(indent+1), obj)
            }
        }
        BayLog.info("%sbusyList: %d", StrUtil.indent(indent+1), this.busyList.length)
        if(BayLog.isDebug()) {
            for(const obj of this.busyList) {
                BayLog.debug("%s%s", StrUtil.indent(indent + 1), obj)
            }
        }
        super.printUsage(indent);
    }
}