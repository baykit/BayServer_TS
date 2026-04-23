import {ReqContentHandler} from "../../tour/reqContentHandler";
import {Tour} from "../../tour/tour";
import {BayLog} from "../../bayLog";
import {ContentConsumeListener, ContentConsumeListenerUtil} from "../../tour/contentConsumeListener";
import {SysUtil} from "../../util/sysUtil";
import {HttpException} from "../../httpException";
import {HttpStatus} from "../../util/httpStatus";
import {Mimes} from "../../util/mimes";
import {StrUtil} from "../../util/strUtil";
import {PlainTransporter} from "../../agent/multiplexer/plainTransporter";
import {GrandAgent} from "../../agent/grandAgent";
import {FileRudder} from "../../rudder/fileRudder";
import {SendFileShip} from "./sendFileShip";
import * as fs from "fs";
import {RudderState} from "../../common/rudderState";
import {RudderStateStore} from "../../common/rudderStateStore";
import {BayServer} from "../../bayserver";
import {MULTIPLEXER_TYPE_PIGEON} from "../harbor";
import {Multiplexer} from "../../common/multiplexer";
import {Rudder} from "../../rudder/rudder";
import {Sink} from "../../sink";
import {FileStore, FileContentStatus} from "./fileStore";
import {FileContent} from "./fileContent";
import {IOException} from "../../util/ioException";

export class FileContentHandler implements ReqContentHandler {

    readonly tour: Tour;
    readonly path: string;
    readonly charset: string;
    readonly store: FileStore;
    mimeType: string;
    abortable: boolean;
    fileContent: FileContent;

    constructor(tur: Tour, store: FileStore, path: string, charset: string) {
        this.tour = tur;
        this.store = store;
        this.path = path;
        this.charset = charset;
        this.abortable = true;

        let mimeType: string = null;
        let pos = path.lastIndexOf('.');
        if (pos >= 0) {
            let ext = path.substring(pos + 1).toLowerCase();
            mimeType = Mimes.getType(ext);
        }
        if (mimeType == null)
            mimeType = "application/octet-stream";
        if (mimeType.startsWith("text/") && StrUtil.isSet(charset))
            mimeType = mimeType + "; charset=" + charset;
        this.mimeType = mimeType;
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
        if (this.tour.isZombie())
            return;

        if (!SysUtil.exists(this.path)) {
            throw new HttpException(HttpStatus.NOT_FOUND, this.path);
        }

        if (this.store == null) {
            this.sendFileAsync();
            return;
        }

        let fileSize = SysUtil.getFileSize(this.path);
        let status = this.store.get(this.path, fileSize);
        this.fileContent = status.fileContent;

        BayLog.debug("%s file content status: %d", this.tour, status.status);
        switch (status.status) {
            case FileContentStatus.STARTED:
            case FileContentStatus.EXCEEDED:
                this.sendFileAsync();
                break;

            case FileContentStatus.COMPLETED:
                this.sendFileFromCache();
                break;

            default:
                throw new Sink();
        }
    }

    sendFileAsync(): void {
        let fileSize = SysUtil.getFileSize(this.path);
        this.tour.res.headers.setContentType(this.mimeType);
        this.tour.res.headers.setContentLength(fileSize);
        try {
            this.tour.res.sendHeaders(Tour.TOUR_ID_NOCHECK);

            let bufsize = this.tour.ship.protocolHandler.maxResPacketDataSize();
            let agt = GrandAgent.get(this.tour.ship.agentId);
            let fd = fs.openSync(this.path, "r");

            let mpx: Multiplexer = null;
            let rd: Rudder = null;
            switch (BayServer.harbor.getFileMultiplexer()) {
                case MULTIPLEXER_TYPE_PIGEON:
                    mpx = agt.pigeonMultiplexer;
                    rd = new FileRudder(fd);
                    break;

                default:
                    throw new Sink();
            }

            let sip = new SendFileShip();
            let tp = new PlainTransporter(mpx, sip, true, bufsize, false);

            sip.initSendFileShip(rd, tp, this.tour, this.fileContent);
            let sid = sip.id();
            this.tour.res.setConsumeListener((len, resume) => {
                if (resume)
                    sip.resumeRead(sid);
            });

            let st = RudderStateStore.getStore(this.tour.ship.agentId).rent();
            st.init(rd, tp);
            mpx.addRudderState(rd, st);
            mpx.reqRead(rd);

        } catch (e) {
            BayLog.error_e(e);
            throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, this.path);
        }
    }

    sendFileFromCache(): void {
        this.tour.res.setConsumeListener(ContentConsumeListenerUtil.devNull);
        this.tour.res.headers.setContentType(this.mimeType);
        this.tour.res.headers.setContentLength(this.fileContent.length);
        try {
            this.tour.res.sendHeaders(Tour.TOUR_ID_NOCHECK);
            this.tour.res.sendResContent(
                Tour.TOUR_ID_NOCHECK,
                this.fileContent.content, 0, this.fileContent.length);
            this.tour.res.endResContent(Tour.TOUR_ID_NOCHECK);
        } catch (e) {
            if (e instanceof IOException) {
                BayLog.error_e(e);
                throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, this.path);
            }
            else
                throw e;
        }
    }
}
