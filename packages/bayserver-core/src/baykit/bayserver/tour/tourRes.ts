import {Tour} from "./tour";
import {Reusable} from "../util/Reusable";
import {HttpException} from "../httpException";
import {ContentConsumeListener, ContentConsumeListenerUtil} from "./contentConsumeListener";
import {SysUtil} from "../util/sysUtil";
import {HttpStatus} from "../util/httpStatus";
import {Mimes} from "../util/mimes";
import * as fs from "fs";
import {HttpHeaders} from "../util/httpHeaders";
import {BayServer} from "../bayserver";
import {StrUtil} from "../util/strUtil";
import {PlainTransporter} from "../agent/transporter/plainTransporter";
import {SendFileYacht} from "./sendFileYacht";
import {BayLog} from "../bayLog";
import {Sink} from "../sink";
import {ProtocolException} from "../protocol/protocolException";
import {ChannelWrapper} from "../agent/channelWrapper";
import {IOException} from "../util/ioException";
import {InboundHandler} from "../docker/base/inboundHandler";

export class TourRes implements Reusable{

    private readonly tour: Tour;
    /**
     * Response header info
     */
    headers: HttpHeaders = new HttpHeaders();

    charset: string;
    headerSent: boolean;

    /**
     * Response content info
     */
    available: boolean;
    bytesPosted: number;
    bytesConsumed: number;
    bytesLimit: number;
    yacht: SendFileYacht

    public resConsumeListener: ContentConsumeListener;
    canCompress: boolean;
    //compressor] GzipCompressor;
    //yacht: SendFileYacht;

    constructor(tour: Tour) {
        this.tour = tour
    }


    init() {
        this.yacht = new SendFileYacht();
    }

    toString(): string {
        return this.tour.toString();
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////
    reset() {
        this.headers.clear();
        this.bytesPosted = 0;
        this.bytesConsumed = 0;
        this.bytesLimit = 0;

        this.charset = null;
        this.headerSent = false;
        this.yacht.reset();
        this.available = false;
        this.resConsumeListener = null;
        this.canCompress = false;
        //this.compressor = null;
    }

    sendHeaders(checkId: number) {
        this.tour.checkTourId(checkId);

        if (this.tour.isZombie())
            return;

        if (this.headerSent)
            return;

        BayLog.trace("%s sendHeaders contLen=%d", this.tour, this.headers.contentLength());
        this.bytesLimit = this.headers.contentLength();

        // Compress check
        if (BayServer.harbor.getGzipComp() &&
            this.headers.contains(HttpHeaders.CONTENT_TYPE) &&
            this.headers.contentType().toLowerCase().startsWith("text/") &&
            !this.headers.contains(HttpHeaders.CONTENT_ENCODING)) {
            let enc = this.tour.req.headers.get(HttpHeaders.ACCEPT_ENCODING);
            if (enc != null) {
                let parts = enc.split(",");
                for (const part of parts) {
                    if (StrUtil.eqIgnoreCase(part.trim(), "gzip")) {
                        this.canCompress = true;
                        this.headers.set(HttpHeaders.CONTENT_ENCODING, "gzip");
                        this.headers.remove(HttpHeaders.CONTENT_LENGTH);
                        break;
                    }
                }
            }
        }

        try {
            this.tour.ship.sendHeaders(this.tour.shipId, this.tour);
        }
        catch(e) {
            BayLog.debug("%s Error on sending headers: %s", this.tour, e.message);
            this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ABORTED);
            throw e;
        }
        finally {
            this.headerSent = true;
        }
    }


    setConsumeListener(listener: (len, resume) => void) {
        this.resConsumeListener = listener;
        this.bytesConsumed = 0;
        this.bytesPosted = 0;
        this.available = true;
    }

    sendContent(checkId: number, buf: Buffer, ofs: number, len: number) {
        if (buf == null)
            throw new Error("nullPo");
        this.tour.checkTourId(checkId);
        BayLog.trace("%s send content: len=%d", this, len);


        // New listener
        let lis = () => {
            //BayLog.debug("%s call back. consumed", this.tour)
            this.consumed(checkId, len);
        };

        if (this.tour.isZombie()) {
            BayLog.debug("%s zombie return", this);
            lis();
            return true;
        }

        if (!this.headerSent)
            throw new Sink("BUG!: Header not sent");

        if (this.resConsumeListener == null)
            throw new Sink("Response consume listener is null");

        this.bytesPosted += len;
        BayLog.debug("%s posted res content len=%d posted=%d limit=%d consumed=%d",
            this.tour, len, this.bytesPosted, this.bytesLimit, this.bytesConsumed);
        if (this.bytesLimit > 0 && this.bytesPosted > this.bytesLimit) {
            throw new ProtocolException("Post data exceed content-length: " + this.bytesPosted + "/" + this.bytesLimit);
        }

        if(this.tour.isZombie() || this.tour.isAborted()) {
            // Don't send peer any data. Do nothing
            BayLog.debug("%s Aborted or zombie tour. do nothing: %s state=%s", this, this.tour, this.tour.state)
            lis()
        }
        else {
            if (this.canCompress) {
                //this.getCompressor().compress(buf, ofs, len, lis);
            } else {
                try {
                    this.tour.ship.sendResContent(this.tour.shipId, this.tour, buf, ofs, len, lis);
                }
                catch(e) {
                    lis()
                    this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ABORTED);
                    throw e;
                }
            }
        }

        let oldAvailable: boolean = this.available;
        if(!this.bufferAvailable())
            this.available = false;
        if(oldAvailable && !this.available)
            BayLog.debug("%s response unavailable (_ _): posted=%d consumed=%d", this,  this.bytesPosted, this.bytesConsumed);

        return this.available;
    }

    endContent(chkId: number) {
        this.tour.checkTourId(chkId);

        BayLog.debug("%s end ResContent", this);
        if (this.tour.isEnded()) {
            BayLog.debug("%s Tour is already ended (Ignore).", this)
            return
        }

        if (!this.tour.isZombie() && this.tour.city != null)
            this.tour.city.log(this.tour);

        // send end message
        if (this.canCompress) {
            //this.getCompressor().finish();
        }

        let tourReturned = false
        let callback = () => {
            this.tour.checkTourId(chkId)
            this.tour.ship.returnTour(this.tour);
            tourReturned = true
        }

        try {
            if(this.tour.isZombie() || this.tour.isAborted()) {
                // Don't send peer any data. Only return tour
                BayLog.debug("%s Aborted or zombie tour. do nothing: %s state=%s", this, this.tour, this.tour.state)
                callback();
            }
            else {
                try {
                    this.tour.ship.sendEndTour(this.tour.shipId, this.tour, callback);
                }
                catch (e) {
                    if(!(e instanceof IOException))
                        throw e
                    else {
                        BayLog.debug("%s Error on sending end tour", this)
                        callback()
                        throw e
                    }
                }
            }
        }
        finally {
            // If tour is returned, we cannot change its state because
            // it will become uninitialized.
            BayLog.debug("%s Tour is returned (id=%d): %s (state=%d)", this, chkId, tourReturned, this.tour.state)
            if (!tourReturned) {
                this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ENDED);
            }
        }
    }

    //////////////////////////////////////////////////////
    // Methods to sending error
    //////////////////////////////////////////////////////
    sendHttpException(chkId: number, e: HttpException) {
        if (e.status == HttpStatus.MOVED_TEMPORARILY || e.status == HttpStatus.MOVED_PERMANENTLY)
            this.sendRedirect(chkId, e.status, e.location);
        else
            this.sendError(chkId, e.status, e.message, e);
    }

    sendError(
        chkId: number,
        status: number = HttpStatus.INTERNAL_SERVER_ERROR,
        message: string = "",
        e: Error = null) {

        this.tour.checkTourId(chkId);

        if (this.tour.isZombie())
            return;

        if(this.headerSent) {
            BayLog.debug("Try to send error after response header is sent (Ignore)");
            BayLog.debug("%s: status=%d, message=%s", this, status, message);
            if (e != null)
                BayLog.debug_e(e);
        }
        else {
            this.setConsumeListener(ContentConsumeListenerUtil.devNull);

            if(this.tour.isZombie() || this.tour.isAborted()) {
                // Don't send peer any data. Do nothing
                BayLog.debug("%s Bborted or zombie tour. do nothing: %s state=%s", this, this.tour, this.tour.state)
            }
            else {
                try {
                    this.tour.ship.sendError(this.tour.shipId, this.tour, status, message, e);
                }
                catch(e) {
                    if(e instanceof IOException) {
                        BayLog.debug_e(e, "%s IOException while sending error", this)
                        this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ABORTED);
                    }
                    else {
                        throw e
                    }
                }
                this.headerSent = true;
            }
        }
        this.endContent(chkId);
    }

    //////////////////////////////////////////////////////
    // Sending file methods
    //////////////////////////////////////////////////////

    sendFile(chkId: number, file: string, charset: string, async: boolean) {
        this.tour.checkTourId(chkId);

        if (this.tour.isZombie())
            return;

        if (SysUtil.isDirectory(file)) {
            throw new HttpException(HttpStatus.FORBIDDEN, file);
        } else if (!SysUtil.exists(file)) {
            throw new HttpException(HttpStatus.NOT_FOUND, file);
        }

        var mimeType: string = null;

        let rname = file;
        let pos = rname.lastIndexOf('.');
        if (pos >= 0) {
            let ext = rname.substring(pos + 1).toLowerCase();
            mimeType = Mimes.getType(ext);
        }

        if (mimeType == null)
            mimeType = "application/octet-stream";

        if (mimeType.startsWith("text/") && StrUtil.isSet(this.charset))
            mimeType = mimeType + "; charset=" + charset;

        //resHeaders.setStatus(HttpStatus.OK);
        let fileSize = SysUtil.getFileSize(file)
        this.headers.setContentType(mimeType);
        this.headers.setContentLength(fileSize);
        try {
            this.sendHeaders(Tour.TOUR_ID_NOCHECK);

            let bufsize = this.tour.ship.protocolHandler.maxResPacketDataSize();
            let fd = fs.openSync(file, "r")
            let buf = Buffer.alloc(8192);
            let tp = new PlainTransporter(false, bufsize);
            this.yacht.init(this.tour, file, fileSize, tp);
            let ch = new ChannelWrapper(fd)
            tp.init(this.tour.ship.agent.nonBlockingHandler, ch, this.yacht);
            tp.openValve();

        } catch (e) {
            BayLog.error_e(e)
            throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, file);
        }
    }

    private sendRedirect(chkId: number, status: number, location: string): void {
        this.tour.checkTourId(chkId);

        if(this.headerSent) {
            BayLog.error("Try to redirect after response header is sent (Ignore)");
        }
        else {
            this.setConsumeListener(ContentConsumeListenerUtil.devNull);
            this.tour.ship.sendRedirect(this.tour.shipId, this.tour, status, location);
            this.headerSent = true;
        }

        this.endContent(chkId);
    }

    private consumed(chkId: number, len: number) {
        this.tour.checkTourId(chkId);
        if (this.resConsumeListener == null)
            throw new Sink("Response consume listener is null");

        this.bytesConsumed += len;

        BayLog.debug("%s resConsumed: len=%d posted=%d consumed=%d limit=%d",
            this.tour, len, this.bytesPosted, this.bytesConsumed, this.bytesLimit);

        var resume: boolean = false;
        var oldAvailable: boolean = this.available;
        if(this.bufferAvailable())
            this.available = true;
        if(!oldAvailable && this.available) {
            BayLog.debug("%s response available (^o^): posted=%d consumed=%d", this,  this.bytesPosted, this.bytesConsumed);
            resume = true;
        }

        if(this.tour.isRunning()) {
            this.resConsumeListener(len, resume);
        }
    }

    private bufferAvailable() {
        return this.bytesPosted - this.bytesConsumed < BayServer.harbor.getTourBufferSize();
    }
}
