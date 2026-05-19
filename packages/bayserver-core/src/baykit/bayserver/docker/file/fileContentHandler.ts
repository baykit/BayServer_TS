import {ReqContentHandler} from "../../tour/reqContentHandler";
import {Tour} from "../../tour/tour";
import {BayLog} from "../../bayLog";
import {ContentConsumeListener} from "../../tour/contentConsumeListener";
import {HttpException} from "../../httpException";
import {HttpStatus} from "../../util/httpStatus";
import {DirectoryException} from "../../util/directoryException";

export class FileContentHandler implements ReqContentHandler {

    readonly tour: Tour;
    readonly path: string;
    readonly charset: string;
    readonly listFiles: boolean;
    abortable: boolean;

    constructor(tur: Tour, path: string, charset: string, listFiles: boolean) {
        this.tour = tur;
        this.path = path;
        this.charset = charset;
        this.abortable = true;
        this.listFiles = listFiles;
    }

    //////////////////////////////////////////////////////
    // Implements ReqContentHandler
    //////////////////////////////////////////////////////

    onReadReqContent(tur: Tour, buf, start: number, len: number, lis: ContentConsumeListener): void {
        BayLog.debug("%s onReadContent(Ignore) len=%d", tur, len);
        tur.req.consumed(tur.tourId, len, lis)
    }

    onEndReqContent(tur: Tour): void {
        BayLog.debug("%s endContent", tur);
        this.reqStartTour();
        this.abortable = false;
    }

    onAbortReq(tur: Tour): boolean {
        BayLog.debug("%s file:onAbort aborted=%s", tur, this.abortable);
        return this.abortable;
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    reqStartTour(): void {
        BayLog.debug("%s reqStartTour", this.tour);

        try {
            this.tour.res.sendFile(this.path, this.charset);
        }
        catch (e) {
            if (e instanceof DirectoryException) {
                this.handleDirectory(this.tour, this.path);
            }
            else if (e != null && (e.code == "ENOENT" || e instanceof HttpException && e.status == HttpStatus.NOT_FOUND)) {
                throw new HttpException(HttpStatus.NOT_FOUND, this.path);
            }
            else if (e instanceof HttpException) {
                throw e;
            }
            else {
                BayLog.error_e(e);
                throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, this.path);
            }
        }
    }

    private handleDirectory(tur: Tour, path: string): void {
        if (this.listFiles) {
            // TODO: port DirectoryTrain from Java
            throw new HttpException(HttpStatus.FORBIDDEN, "Directory listing not implemented in TS port");
        }
        else {
            throw new HttpException(HttpStatus.FORBIDDEN, "Directory scan is prohibited");
        }
    }
}
