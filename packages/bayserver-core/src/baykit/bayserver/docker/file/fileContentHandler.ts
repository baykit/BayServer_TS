import {ReqContentHandler} from "../../tour/reqContentHandler";
import {Tour} from "../../tour/tour";
import {BayLog} from "../../bayLog";

export class FileContentHandler implements ReqContentHandler {

    readonly path: string;
    abortable: boolean;

    constructor(path: string) {
        this.path = path;
        this.abortable = true;
    }

    //////////////////////////////////////////////////////
    // Implements ReqContentHandler
    //////////////////////////////////////////////////////

    onReadContent(tur: Tour, buf, start: number, len: number): void {
        BayLog.debug("%s onReadContent(Ignore) len=%d", tur, len);
    }

    onEndContent(tur: Tour): void {
        BayLog.debug("%s endContent", tur);
        tur.res.sendFile(Tour.TOUR_ID_NOCHECK, this.path, tur.res.charset, true);
        this.abortable = false;
    }




    onAbort(tur: Tour): boolean {
        return false;
    }

}