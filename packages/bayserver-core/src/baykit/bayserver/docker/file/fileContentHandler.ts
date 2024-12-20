import {ReqContentHandler} from "../../tour/reqContentHandler";
import {Tour} from "../../tour/tour";
import {BayLog} from "../../bayLog";
import {ContentConsumeListener} from "../../tour/contentConsumeListener";
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
import {RudderState} from "../../agent/multiplexer/rudderState";
import {BayServer} from "../../bayserver";
import {MULTIPLEXER_TYPE_PIGEON} from "../harbor";
import {Multiplexer} from "../../common/multiplexer";
import {Rudder} from "../../rudder/rudder";
import {Sink} from "../../sink";

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

    onReadReqContent(tur: Tour, buf, start: number, len: number, lis: ContentConsumeListener): void {
        BayLog.debug("%s onReadContent(Ignore) len=%d", tur, len);
        tur.req.consumed(tur.tourId, len, lis)
    }

    onEndReqContent(tur: Tour): void {
        BayLog.debug("%s endContent", tur);
        this.sendFileAsync(tur, this.path, tur.res.charset);
        this.abortable = false;
    }

    onAbortReq(tur: Tour): boolean {
        BayLog.debug("%s file:onAbort aborted=%s", tur, this.abortable);
        return this.abortable;
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    sendFileAsync(tur: Tour, file: string, charset: string) {

        if (tur.isZombie())
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

        if (mimeType.startsWith("text/") && StrUtil.isSet(charset))
            mimeType = mimeType + "; charset=" + charset;

        //resHeaders.setStatus(HttpStatus.OK);
        let fileSize = SysUtil.getFileSize(file)
        tur.res.headers.setContentType(mimeType);
        tur.res.headers.setContentLength(fileSize);
        try {
            tur.res.sendHeaders(Tour.TOUR_ID_NOCHECK);

            let bufsize = tur.ship.protocolHandler.maxResPacketDataSize();
            let agt = GrandAgent.get(tur.ship.agentId)
            let fd = fs.openSync(file, "r")

            let mpx: Multiplexer = null
            let rd: Rudder = null
            switch(BayServer.harbor.getFileMultiplexer()) {
                case MULTIPLEXER_TYPE_PIGEON:
                    mpx = agt.pigeonMultiplexer
                    rd = new FileRudder(fd)
                    break

                default:
                    throw new Sink()
            }

            let buf = Buffer.alloc(8192);

            let sip = new SendFileShip()
            let tp =
                new PlainTransporter(
                    mpx,sip, true, bufsize, false);

            sip.initSendFileShip(rd, tp, tur)
            let sid = sip.id()
            tur.res.setConsumeListener((len, resume) => {
                if(resume)
                    sip.resumeRead(sid)
            })
            mpx.addRudderState(rd, new RudderState(rd, tp))
            mpx.reqRead(rd)

        } catch (e) {
            BayLog.error_e(e)
            throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, file);
        }
    }


}