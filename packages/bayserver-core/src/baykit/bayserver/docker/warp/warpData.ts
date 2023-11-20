import {ReqContentHandler} from "../../tour/reqContentHandler";
import {HttpHeaders} from "../../util/httpHeaders";
import {Tour} from "../../tour/tour";
import {BayLog} from "../../bayLog";
import {WarpShip} from "./warpShip";
import {Sink} from "../../sink"

export class WarpData implements ReqContentHandler {

    readonly warpShip: WarpShip
    readonly warpShipId: number
    readonly warpId: number
    readonly reqHeaders = new HttpHeaders()
    readonly resHeaders = new HttpHeaders()
    started: boolean
    ended: boolean


    constructor(warpShip: WarpShip, warpId: number) {
        this.warpShip = warpShip;
        this.warpShipId = warpShip.id()
        this.warpId = warpId;
    }

    toString(): string {
        return this.warpShip + " wtur#" + this.warpId;
    }

    //////////////////////////////////////////////////////
    // Implements ReqContentHandler
    //////////////////////////////////////////////////////
    onReadContent(tur: Tour, buf: Buffer, start: number, len: number): void {
        BayLog.debug("%s onReadReqContent tur=%s len=%d", this.warpShip, tur, len);
        this.warpShip.checkShipId(this.warpShipId);
        let maxLen = this.warpShip.protocolHandler.maxReqPacketDataSize();
        for(let pos = 0; pos < len; pos += maxLen) {
            let postLen = len - pos;
            if(postLen > maxLen) {
                postLen = maxLen;
            }
            let turId = tur.id();

            if(!this.started)
                // The buffer will become corrupted due to reuse.
                buf = Buffer.from(buf)

            this.warpShip.getWarpHandler().postWarpContents(
                tur,
                buf,
                start + pos,
                postLen,
                () => tur.req.consumed(turId, len));
        }
    }

    onEndContent(tur: Tour): void {
        BayLog.debug("%s endReqContent tur=%s", this.warpShip, tur);
        this.warpShip.checkShipId(this.warpShipId);
        this.warpShip.getWarpHandler().postWarpEnd(tur);
    }

    onAbort(tur: Tour): boolean {
        BayLog.debug("%s onAbortReq tur=%s", this.warpShip, tur);
        this.warpShip.checkShipId(this.warpShipId);
        BayLog.debug("%s WarpShip abort", this.warpShip);
        this.warpShip.abort(this.warpShipId);
        return false; // not aborted immediately
    }


    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    start(): void {
        if(this.started)
            throw new Sink("%s Warp tour already started", this)

        BayLog.debug("%s Start Warp tour", this);
        this.warpShip.flush();
        this.started = true;
    }

    static get(tur: Tour): WarpData {
        return tur.req.contentHandler as WarpData
    }


}