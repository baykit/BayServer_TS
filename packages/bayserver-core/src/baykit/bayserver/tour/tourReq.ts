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
    consumeListener: ContentConsumeListener;
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
        this.consumeListener = null;
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

    setContentHandler(hnd: ReqContentHandler) {
        if(hnd == null)
            throw new Error("nullPo")
        if(this.contentHandler != null)
            throw new Sink("content handler is already set");

        this.contentHandler = hnd;
    }

    setConsumeListener(limit: number, listener: ContentConsumeListener) {
        if (limit < 0) {
            throw new Sink("Invalid limit");
        }
        this.consumeListener = listener;
        this.bytesLimit = limit;
        this.bytesConsumed = 0;
        this.bytesPosted = 0;
        this.available = true;
    }

    postContent(checkId: number, data: Buffer, start: number, len: number): boolean {
        this.tour.checkTourId(checkId);
        if(!this.tour.isRunning()) {
            BayLog.debug("%s tour is not running.", this.tour);
            return true;
        }

        if (this.tour.req.contentHandler == null) {
            BayLog.warn("%s content read, but no content handler", this.tour);
            return true;
        }

        if (this.consumeListener == null) {
            throw new Sink("Request consume listener is null");
        }

        if (this.bytesPosted + len > this.bytesLimit) {
            throw new ProtocolException(
                BayMessage.get(
                    Symbol.HTP_READ_DATA_EXCEEDED,
                    this.bytesPosted + length,
                    this.bytesLimit))
        }

        // If has error, only read content. (Do not call content handler)
        if(this.tour.error == null)
            this.contentHandler.onReadContent(this.tour, data, start, len);

        this.bytesPosted += len;

        BayLog.debug("%s rread content: len=%d posted=%d limit=%d consumed=%d available=%s",
                this.tour, len, this.bytesPosted, this.bytesLimit, this.bytesConsumed, this.available);

        if(this.tour.error == null)
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

        if (this.bytesLimit >= 0 && this.bytesPosted != this.bytesLimit) {
            throw new ProtocolException("nvalid request data length: " + this.bytesPosted + "/" + this.bytesLimit);
        }
        if (this.contentHandler != null)
            this.contentHandler.onEndContent(this.tour);
        this.ended = true;
    }

    consumed(checkId: number, length: number) {
        this.tour.checkTourId(checkId);
        if (this.consumeListener == null)
            throw new Sink("Request consume listener is null");

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

        this.consumeListener(length, resume);
    }

    abort(): boolean {
        if(!this.tour.isPreparing()) {
            BayLog.debug("%s cannot abort non-preparing tour", this.tour)
            return false
        }

        BayLog.debug("%s req abort", this.tour);
        if (this.tour.isAborted())
            throw new Sink("tour is already aborted");

        let aborted: boolean = true;
        if (this.tour.isRunning() && this.contentHandler != null)
            aborted = this.contentHandler.onAbort(this.tour);

        if(aborted)
            this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ABORTED);

        return aborted;
    }

    private bufferAvailable(): boolean {
        return this.bytesPosted - this.bytesConsumed < BayServer.harbor.getTourBufferSize();
    }
}