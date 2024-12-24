import {Tour} from "./tour";
import {ReqContentHandler} from "./reqContentHandler";
import {ContentConsumeListener} from "./contentConsumeListener";
import {HttpHeaders} from "../util/httpHeaders";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {ProtocolException} from "../protocol/protocolException";
import {BayServer} from "../bayserver";
import {Reusable} from "../util/Reusable";
import {BayMessage} from "../bayMessage";
import {Symbol} from "../symbol";
import {HttpException} from "../httpException";
import {HttpStatus} from "../util/httpStatus";

export type RemoteHostResolver = () => string
export class TourReq implements Reusable {
    private readonly tour: Tour;
    /**
     * Request Header info
     */
    key: number;  // request id in FCGI or stream id in HTTP/2

    uri: string;
    protocol: string;
    method: string;

    headers: HttpHeaders = new HttpHeaders();

    rewrittenURI: string; // set if URI is rewritten
    queryString: string;
    pathInfo;
    scriptName: string;
    reqHost;  // from Host header
    reqPort: number;     // from Host header

    remoteUser: string;
    remotePass: string;

    remoteAddress: string;
    remotePort: number;
    remoteHostFunc: RemoteHostResolver   // remote host is resolved on demand since performance reason

    serverAddress: string;
    serverPort: number;
    serverName: string;
    charset: string;

    /**
     * Request content info
     */
    bytesPosted: number;
    bytesConsumed: number;
    bytesLimit: number;
    contentHandler: ReqContentHandler;
    available: boolean;
    ended: boolean;

    constructor(tour: Tour) {
        this.tour = tour;
    }


    init(key: number) {
        this.key = key;
    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////
     reset() {
        this.headers.clear();
        this.key = 0;
        this.uri = null;
        this.method = null;
        this.protocol = null;
        this.bytesPosted = 0;
        this.bytesConsumed = 0;
        this.bytesLimit = 0;

        this.rewrittenURI = null;
        this.queryString = null;
        this.pathInfo = null;
        this.scriptName = null;
        this.reqHost = null;
        this.reqPort = 0;
        this.remoteUser = null;
        this.remotePass = null;

        this.remoteAddress = null;
        this.remotePort = 0;
        this.remoteHostFunc = null;
        this.serverAddress = null;
        this.serverPort = 0;
        this.serverName = null;

        this.charset = null;
        this.contentHandler = null;
        this.available = false;
        this.ended = false;
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    remoteHost(): string {
        if (this.remoteHostFunc == null)
            return null;
        else
            return this.remoteHostFunc();
    }

    setReqContentHandler(hnd: ReqContentHandler) {
        if(hnd == null)
            throw new Error("nullPo")
        if(this.contentHandler != null)
            throw new Sink("content handler is already set");

        this.contentHandler = hnd;
    }

    setLimit(limit: number) {
        if (limit < 0) {
            throw new Sink("Invalid limit");
            }
        this.bytesLimit = limit;
        this.bytesConsumed = 0;
        this.bytesPosted = 0;
        this.available = true;
    }

    postReqContent(checkId: number, data: Buffer, start: number, len: number, lis: ContentConsumeListener): boolean {
        this.tour.checkTourId(checkId);

        let dataPassed = false

        if(this.tour.error != null)
            // If has error, only read content. (Do not call content handler)
            BayLog.debug("%s tour has error.", this.tour)

        else if(!this.tour.isReading()) {
            throw new HttpException(HttpStatus.BAD_REQUEST, "%s tour is not reading.", this.tour)
        }

        else if (this.tour.req.contentHandler == null) {
            BayLog.warn("%s content read, but no content handler", this.tour);
        }

        else if (this.bytesPosted + len > this.bytesLimit) {
            throw new ProtocolException(
                BayMessage.get(
                    Symbol.HTP_READ_DATA_EXCEEDED,
                    this.bytesPosted + len,
                    this.bytesLimit))
        }

        else {
            this.contentHandler.onReadReqContent(this.tour, data, start, len, lis);
            dataPassed = true
        }

        this.bytesPosted += len;
        BayLog.debug("%s read content: len=%d posted=%d limit=%d consumed=%d available=%s",
                this.tour, len, this.bytesPosted, this.bytesLimit, this.bytesConsumed, this.available);

        if(!dataPassed)
            return true;

        let oldAvailable = this.available;
        if(!this.bufferAvailable())
            this.available = false;
        if(oldAvailable && !this.available) {
            BayLog.debug("%s request unavailable (_ _).zZZ: posted=%d consumed=%d",
                this, this.bytesPosted, this.bytesConsumed);
        }

        return this.available;
    }

    endContent(checkId: number) {
        BayLog.debug(this.tour + " endReqContent");
        this.tour.checkTourId(checkId);
        if (this.ended)
            throw new Sink(this.tour + " Request content is already ended");

        this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_RUNNING)
        this.ended = true;

        if (this.bytesLimit >= 0 && this.bytesPosted != this.bytesLimit) {
            throw new ProtocolException("Invalid request data length: " + this.bytesPosted + "/" + this.bytesLimit);
        }
        if (this.contentHandler != null)
            this.contentHandler.onEndReqContent(this.tour);
    }

    consumed(checkId: number, length: number, lis: ContentConsumeListener) {
        this.tour.checkTourId(checkId);

        this.bytesConsumed += length;
        BayLog.debug("%s reqConsumed: len=%d posted=%d limit=%d consumed=%d available=%s",
            this.tour, length, this.bytesPosted, this.bytesLimit, this.bytesConsumed, this.available);

        let resume: boolean = false;

        let oldAvailable: boolean = this.available;
        if(this.bufferAvailable())
            this.available = true;
        if(!oldAvailable && this.available) {
            BayLog.debug("%s request available (^o^): posted=%d consumed=%d", this,  this.bytesPosted, this.bytesConsumed);
            resume = true;
        }

        lis(length, resume);
    }

    abort(): boolean {
        BayLog.debug("%s abort tour", this.tour);
        if(this.tour.isPreparing()) {
            this.tour.changeState(this.tour.tourId, Tour.STATE_ABORTED);
            return true
        }
        else if(this.tour.isRunning()) {
            let aborted: boolean = true;
            if (this.contentHandler != null)
                aborted = this.contentHandler.onAbortReq(this.tour);
            if(aborted)
                this.tour.changeState(this.tour.tourId, Tour.STATE_ABORTED);
            return aborted;
        }
        else {
            BayLog.debug("%s tour is not preparing or not running", this.tour);
            return false;
        }
    }

    private bufferAvailable(): boolean {
        return this.bytesPosted - this.bytesConsumed < BayServer.harbor.getTourBufferSize();
    }
}