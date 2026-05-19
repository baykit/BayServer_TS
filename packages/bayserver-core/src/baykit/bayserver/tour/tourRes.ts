import {Tour} from "./tour";
import {Reusable} from "../util/Reusable";
import {HttpException} from "../httpException";
import {ContentConsumeListener, ContentConsumeListenerUtil} from "./contentConsumeListener";
import {HttpStatus} from "../util/httpStatus";
import {HttpHeaders} from "../util/httpHeaders";
import {BayServer} from "../bayserver";
import {StrUtil} from "../util/strUtil";
import {BayLog} from "../bayLog";
import {Sink} from "../sink";
import {ProtocolException} from "../protocol/protocolException";
import {IOException} from "../util/ioException";
import {
    Trouble,
    TROUBLE_METHOD_GUIDE,
    TROUBLE_METHOD_REROUTE,
    TROUBLE_METHOD_TEXT,
    TroubleCommand
} from "../docker/trouble";
import {Buffer} from "buffer";
import {Rudder} from "../rudder/rudder";
import {Mimes} from "../util/mimes";
import {SysUtil} from "../util/sysUtil";
import {DirectoryException} from "../util/directoryException";
import {FileStore, FileInfo} from "./fileStore";
import {FileRudder} from "../rudder/fileRudder";
import {GrandAgent} from "../agent/grandAgent";
import {Multiplexer} from "../common/multiplexer";
import {PlainTransporter} from "../agent/multiplexer/plainTransporter";
import {RudderStateStore} from "../common/rudderStateStore";
import {SendFileShip} from "./sendFileShip";
import {MULTIPLEXER_TYPE_PIGEON} from "../docker/harbor";
import * as fs from "fs";

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

    public resConsumeListener: ContentConsumeListener;
    canCompress: boolean;
    //compressor] GzipCompressor;
    //yacht: SendFileYacht;
    directBoarding: boolean = false;

    constructor(tour: Tour) {
        this.tour = tour
    }


    init() {
        this.directBoarding = BayServer.harbor.isDirectBoarding();
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
        this.available = false;
        this.resConsumeListener = null;
        this.canCompress = false;
        //this.compressor = null;
        this.directBoarding = false;
    }

    sendHeaders(checkId: number) {
        //this.tour.checkTourId(checkId);

        if (this.tour.isZombie())
            return;

        if (this.headerSent)
            return;

        if (this.tour.cargo != null) {
            this.tour.cargo.saveHeaders(this.headers);
        }

        BayLog.trace("%s sendHeaders contLen=%d", this.tour, this.headers.contentLength());
        this.bytesLimit = this.headers.contentLength();

        // Compress check
        if (BayServer.harbor.getGzipComp() &&
            this.headers.contains(HttpHeaders.CONTENT_TYPE) &&
            this.headers.contentType().toLowerCase().startsWith("text/") &&
            !this.headers.contains(HttpHeaders.CONTENT_ENCODING)) {
            let enc = this.tour.req.headers.getFast(HttpHeaders.ACCEPT_ENCODING);
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
            var handled: boolean = false;
            if(!this.tour.errorHandling && this.tour.res.headers.status >= 400) {
                let trb: Trouble = BayServer.harbor.getTrouble();
                if(trb != null) {
                    let cmd: TroubleCommand = trb.find(this.tour.res.headers.status);
                    if (cmd != null) {
                        let errTour: Tour = this.tour.ship.getErrorTour();
                        errTour.req.uri = cmd.target;
                        this.tour.req.headers.copyTo(errTour.req.headers);
                        this.tour.res.headers.copyTo(errTour.res.headers);
                        errTour.req.remotePort = this.tour.req.remotePort;
                        errTour.req.remoteAddress = this.tour.req.remoteAddress;
                        errTour.req.serverAddress = this.tour.req.serverAddress;
                        errTour.req.serverPort = this.tour.req.serverPort;
                        errTour.req.serverName = this.tour.req.serverName;
                        errTour.res.headerSent = this.tour.res.headerSent;
                        this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ZOMBIE);
                        switch (cmd.method) {
                            case TROUBLE_METHOD_GUIDE: {
                                try {
                                    errTour.go();
                                } catch (e) {
                                    throw new IOException(e);
                                }
                                break;
                            }

                            case TROUBLE_METHOD_TEXT: {
                                this.tour.ship.sendHeaders(this.tour.shipId, errTour);
                                let data: Buffer = Buffer.from(cmd.target);
                                errTour.res.sendResContent(Tour.TOUR_ID_NOCHECK, data, 0, data.length);
                                errTour.res.endResContent(Tour.TOUR_ID_NOCHECK);
                                break;
                            }

                            case TROUBLE_METHOD_REROUTE: {
                                errTour.res.sendHttpException(Tour.TOUR_ID_NOCHECK, HttpException.movedTemp(cmd.target));
                                break;
                            }
                        }
                        handled = true;
                    }
                }
            }
            if(!handled) {
                this.tour.ship.sendHeaders(this.tour.shipId, this.tour);
            }
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

    sendResContent(checkId: number, buf: Buffer, ofs: number, len: number) {
        if (buf == null)
            throw new Error("nullPo");
        //this.tour.checkTourId(checkId);
        BayLog.trace("%s send content: len=%d cargo=%s", this, len, this.tour.cargo);

        if (this.tour.cargo != null) {
            this.tour.cargo.saveContent(buf, ofs, len);
        }

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
                    this.tour.changeState(this.tour.tourId, Tour.STATE_ABORTED);
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

    endResContent(chkId: number) {
        //this.tour.checkTourId(chkId);

        BayLog.debug("%s end ResContent", this);
        if (this.tour.isEnded()) {
            BayLog.debug("%s Tour is already ended (Ignore).", this)
            return
        }

        if (!this.tour.isZombie() && this.tour.city != null)
            this.tour.city.log(this.tour);

        if (this.tour.cargo != null) {
            this.tour.cargo.endSave();
        }

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
                this.tour.changeState(chkId, Tour.STATE_ENDED);
            }
        }
    }

    sendFile(path: string, charset: string): void {
        let info: FileInfo = null;
        let rd: Rudder = null;
        let fileSize = -1;

        if (this.tour.ship.portDocker.protocol() == "h1" &&
            !this.tour.ship.portDocker.isSecure() &&
            this.directBoarding) {
            // Send via Direct Boarding if the protocol is HTTP/1.x and unencrypted.
            const st = FileStore.getFileStore();
            info = st.get(path);
            rd = info.rudder;
            fileSize = info.fileLength;
            this.directBoarding = info.rudder != null;
        }

        if (rd == null) {
            if (SysUtil.isDirectory(path)) {
                throw new DirectoryException();
            }
            else {
                switch (BayServer.harbor.getFileMultiplexer()) {
                    case MULTIPLEXER_TYPE_PIGEON: {
                        const fd = fs.openSync(path, "r");
                        rd = new FileRudder(fd);
                        break;
                    }
                    default:
                        throw new Sink();
                }
                fileSize = SysUtil.getFileSize(path);
            }
        }

        // Determine MIME type
        let mtype: string = null;
        const pos = path.lastIndexOf('.');
        if (pos >= 0) {
            const ext = path.substring(pos + 1).toLowerCase();
            mtype = Mimes.getType(ext);
        }
        if (mtype == null)
            mtype = "application/octet-stream";
        if (mtype.startsWith("text/") && charset != null)
            mtype = mtype + "; charset=" + charset;

        this.headers.setContentType(mtype);
        this.headers.setContentLength(fileSize);
        this.sendHeaders(Tour.TOUR_ID_NOCHECK);

        if (this.directBoarding) {
            const turId = this.tour.id();
            this.setConsumeListener((len, resume) => {
                try {
                    this.endResContent(turId);
                }
                catch (e) {
                    if (e instanceof IOException)
                        BayLog.debug_e(e);
                    else
                        throw e;
                }
            });
            this.transferContent(Tour.TOUR_ID_NOCHECK, rd, 0, info.fileLength);
        }
        else {
            const bufsize = this.tour.ship.protocolHandler.maxResPacketDataSize();
            const agt = GrandAgent.get(this.tour.ship.agentId);
            let mpx: Multiplexer;

            switch (BayServer.harbor.getFileMultiplexer()) {
                case MULTIPLEXER_TYPE_PIGEON:
                    mpx = agt.pigeonMultiplexer;
                    break;
                default:
                    throw new Sink();
            }

            const sendFileShip = new SendFileShip();
            const tp = new PlainTransporter(mpx, sendFileShip, true, bufsize, false);
            sendFileShip.initSendFile(rd, tp, this.tour);
            const sid = sendFileShip.id();
            this.setConsumeListener((len, resume) => {
                if (resume) {
                    sendFileShip.resumeRead(sid);
                }
            });

            const st = RudderStateStore.getStore(agt.agentId).rent();
            st.init(rd, tp);
            mpx.addRudderState(rd, st);
            mpx.reqRead(rd);
        }
    }

    transferContent(checkId: number, fileRd: Rudder, ofs: number, len: number): void {
        BayLog.debug("%s transfer content: ofs=%d len=%d", this, ofs, len);

        const lis = () => {
            this.tour.checkTourId(checkId);
            this.resConsumeListener(len, false);
        };

        if (this.tour.isZombie()) {
            BayLog.debug("%s zombie tour. return", this);
            lis();
            return;
        }

        if (!this.headerSent)
            throw new Sink("Header not sent");

        this.bytesPosted += len;
        BayLog.debug("%s posted res content len=%d posted=%d limit=%d consumed=%d",
            this.tour, len, this.bytesPosted, this.bytesLimit, this.bytesConsumed);

        if (this.tour.isAborted()) {
            BayLog.debug("%s Aborted tour. do nothing: %s state=%s", this, this.tour, this.tour.state);
            this.tour.changeState(checkId, Tour.STATE_ENDED);
            lis();
        }
        else {
            try {
                this.tour.ship.transferResContent(this.tour.shipId, this.tour, fileRd, ofs, len, lis);
            }
            catch (e) {
                if (e instanceof IOException) {
                    BayLog.debug("%s error on sending resContent: %s", this, e);
                    lis();
                    this.tour.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ABORTED);
                    throw e;
                }
                throw e;
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

        //this.tour.checkTourId(chkId);

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
                        this.tour.changeState(chkId, Tour.STATE_ABORTED);
                    }
                    else {
                        throw e
                    }
                }
                this.headerSent = true;
            }
        }
        this.endResContent(chkId);
    }

    private sendRedirect(chkId: number, status: number, location: string): void {
        //this.tour.checkTourId(chkId);

        if(this.headerSent) {
            BayLog.error("Try to redirect after response header is sent (Ignore)");
        }
        else {
            this.setConsumeListener(ContentConsumeListenerUtil.devNull);
            try {
                this.tour.ship.sendRedirect(this.tour.shipId, this.tour, status, location);
            }
            catch(e) {
                if(e instanceof IOException) {
                    this.tour.changeState(chkId, Tour.STATE_ABORTED)
                }
                throw e
            }
            finally {
                this.headerSent = true;
                this.endResContent(chkId)
            }
        }

        this.endResContent(chkId);
    }

    private consumed(chkId: number, len: number) {
        this.tour.checkTourId(chkId);
        if (this.resConsumeListener == null)
            throw new Sink("Consume listener is null");

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
