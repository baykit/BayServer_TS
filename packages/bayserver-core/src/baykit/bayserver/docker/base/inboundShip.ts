import {Ship} from "../../watercraft/ship";
import {ProtocolHandler} from "../../protocol/protocolHandler";
import {GrandAgent} from "../../agent/grandAgent";
import {Port} from "../port";
import {Counter} from "../../util/counter";
import {TourStore} from "../../tour/tourStore";
import {Tour} from "../../tour/tour";
import {Postman} from "../../util/postman";
import {BayServer} from "../../bayserver";
import {Sink} from "../../sink";
import {BayLog} from "../../bayLog";
import {ArrayUtil} from "../../util/arrayUtil";
import {Trouble, TROUBLE_METHOD_GUIDE, TROUBLE_METHOD_REROUTE, TROUBLE_METHOD_TEXT, TroubleCommand} from "../trouble";
import {IOException} from "../../util/ioException";
import {InboundHandler} from "./inboundHandler";
import {HttpException} from "../../httpException";
import {HttpHeaders} from "../../util/httpHeaders";
import {Buffer} from "buffer";
import {StrUtil} from "../../util/strUtil";
import {HttpStatus} from "../../util/httpStatus";
import {ChannelWrapper} from "../../agent/channelWrapper";

export class InboundShip extends Ship {

    portDocker: Port;

    static errCounter: Counter = new Counter(1);
    needEnd: boolean;
    socketTimeoutSec: number;

    tourStore: TourStore;
    activeTours: Tour[] = []

    reset() {
        super.reset()
        if (!ArrayUtil.empty(this.activeTours)) {
            throw new Sink("%s There are some running tours", this);
        }
        this.needEnd = false;
    }

    public initInbound(
        ch: ChannelWrapper,
        agt: GrandAgent,
        pm: Postman,
        portDkr: Port,
        protoHandler: ProtocolHandler<any, any>) {

        super.init(ch, agt, pm);
        this.portDocker = portDkr;
        this.socketTimeoutSec = portDkr.getTimeoutSec() >= 0 ? portDkr.getTimeoutSec() : BayServer.harbor.getSocketTimeoutSec();
        this.tourStore = TourStore.getStore(agt.agentId);
        this.setProtocolHandler(protoHandler);
    }

    toString(): string {
        return this.agent + " ship#" + this.shipId + "/" + this.objectId + "[" + this.protocol() + "]";
    }

    //////////////////////////////////////////////////////
    // implements Reusable
    //////////////////////////////////////////////////////

    endShip() {
        BayLog.debug("%s endShip", this);
        this.portDocker.returnProtocolHandler(this.agent, this.protocolHandler);
        this.portDocker.returnShip(this);

    }
    abortTours() {
       let returnList: Tour[] = []

        // Abort tours
        for(const tur of this.activeTours) {
            if(tur.isValid()) {
                BayLog.debug("%s is valid, abort it: stat=%s", tur, tur.state);
                if(tur.req.abort()) {
                    BayLog.debug("%s aborted", tur);
                    returnList.push(tur);
                }
            }
        }

        for(const tur of returnList) {
            this.returnTour(tur);
        }
    }


    getTour(turKey: number, force: boolean = false, rent: boolean = true): Tour {
        if(turKey < 0 || turKey >= 0x1000000)
            throw new Error("Invalid tour key: " + turKey)
        let storeKey = InboundShip.uniqKey(this.shipId, turKey);
        var tur: Tour = this.tourStore.get(storeKey);
        if (tur == null && rent) {
            tur = this.tourStore.rent(storeKey, force);
            if(tur == null)
                return null;
            tur.init(turKey, this);
            this.activeTours.push(tur);
        }
        else {
            tur.ship.checkShipId(this.shipId)
        }
        return tur;
    }


    private static uniqKey(sipId: number, turKey: number): BigInt {
        return BigInt(sipId) << BigInt(32) | (BigInt(turKey) & BigInt(0xffffffff));
    }

    returnTour(tur: Tour) {
        BayLog.debug("%s Return tour: %s", this, tur);

        if (!(this.activeTours.includes(tur)))
            throw new Sink("Tour is not in active list: %s", tur);

        this.tourStore.Return(InboundShip.uniqKey(this.shipId, tur.req.key));
        ArrayUtil.remove(tur, this.activeTours);

        if (this.needEnd && ArrayUtil.empty(this.activeTours)) {
            this.endShip();
        }
    }

    getErrorTour(): Tour {
        let turKey = InboundShip.errCounter.next();
        let storeKey = InboundShip.uniqKey(this.shipId, -turKey);
        let tur = this.tourStore.rent(storeKey,true);
        tur.init(-turKey, this);
        this.activeTours.push(tur);
        return tur;
    }

    sendHeaders(chkId: number, tur: Tour) {
        this.checkShipId(chkId);

        if(tur.isZombie() || tur.isAborted()) {
            // Don't send peer any data
            return;
        }

        var handled: boolean = false;
        if(!tur.errorHandling && tur.res.headers.status >= 400) {
            let trb: Trouble = BayServer.harbor.getTrouble();
            if(trb != null) {
                let cmd: TroubleCommand = trb.find(tur.res.headers.status);
                if (cmd != null) {
                    let errTour: Tour = this.getErrorTour();
                    errTour.req.uri = cmd.target;
                    tur.req.headers.copyTo(errTour.req.headers);
                    tur.res.headers.copyTo(errTour.res.headers);
                    errTour.req.remotePort = tur.req.remotePort;
                    errTour.req.remoteAddress = tur.req.remoteAddress;
                    errTour.req.serverAddress = tur.req.serverAddress;
                    errTour.req.serverPort = tur.req.serverPort;
                    errTour.req.serverName = tur.req.serverName;
                    errTour.res.headerSent = tur.res.headerSent;
                    tur.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_ZOMBIE);
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
                            (this.protocolHandler as Object as InboundHandler).sendResHeaders(errTour);
                            let data: Buffer = Buffer.from(cmd.target);
                            errTour.res.sendContent(Tour.TOUR_ID_NOCHECK, data, 0, data.length);
                            errTour.res.endContent(Tour.TOUR_ID_NOCHECK);
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
            for(const nv of this.portDocker.getAdditionalHeaders()) {
                tur.res.headers.add(nv[0], nv[1]);
            }
            (this.protocolHandler as Object as InboundHandler).sendResHeaders(tur);
        }
    }

    sendRedirect(chkId: number, tur: Tour, status: number, location: string): void {
        this.checkShipId(chkId);

        let hdr = tur.res.headers;
        hdr.status = status;
        hdr.set(HttpHeaders.LOCATION, location);

        let body = "<H2>Document Moved.</H2><BR>" + "<A HREF=\""
            + location + "\">" + location + "</A>";

        this.sendErrorContent(chkId, tur, body);
    }

    sendResContent(chkId: number, tur: Tour, buf: Buffer, ofs: number, len: number, lis: () => void) {
        this.checkShipId(chkId);

        let maxLen = this.protocolHandler.maxResPacketDataSize();
        if(len > maxLen) {
            this.sendResContent(Ship.SHIP_ID_NOCHECK, tur, buf, ofs, maxLen, null);
            this.sendResContent(Ship.SHIP_ID_NOCHECK, tur, buf, ofs + maxLen, len - maxLen, lis);
        }
        else {
            (this.protocolHandler as Object as InboundHandler).sendResContent(tur, buf, ofs, len, lis);
        }
    }


    sendEndTour(chkShipId: number, tur: Tour, callback: () => void) {
        this.checkShipId(chkShipId);

        BayLog.debug("%s sendEndTour: %s state=%s", this, tur, tur.state);

        if(!tur.isValid()) {
            throw new Sink("Tour is not valid");
        }
        let keepAlive = false;
        if (tur.req.headers.getConnection() == HttpHeaders.CONNECTION_KEEP_ALIVE)
            keepAlive = true;
        if(keepAlive) {
            let resConn = tur.res.headers.getConnection();
            keepAlive = (resConn == HttpHeaders.CONNECTION_KEEP_ALIVE)
                || (resConn == HttpHeaders.CONNECTION_UNKOWN);
            if (keepAlive) {
                if (tur.res.headers.contentLength() < 0)
                    keepAlive = false;
            }
        }

        (this.protocolHandler as Object as InboundHandler).sendEndTour(tur, keepAlive, callback);
    }

    sendError(chkId: number, tur: Tour, status: number, message: string, e: Error) {
        this.checkShipId(chkId);

        if(tur == null)
            throw new Error("nullPo");

        BayLog.debug_e(e, "%s send error: status=%d, message=%s ex=%s", this, status, message, e == null ? "" : e.message);
        if (e != null)
            BayLog.debug_e(e);

        // Create body
        let str = HttpStatus.description(status);

        // print status
        let body = "<h1>" + status.toString() + " " + str + "</h1>\r\n";

        tur.res.headers.status = status
        this.sendErrorContent(chkId, tur, body);
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////
    private sendErrorContent(chkId: number, tur: Tour, content: string): void {
        // Get charset
        let charset: string = tur.res.charset;

        // Set content type
        if (charset != null && charset != "") {
            tur.res.headers.setContentType("text/html; charset=" + charset);
        }
        else {
            tur.res.headers.setContentType("text/html");
        }

        let bytes: Buffer = null;
        if (content != null && content != "") {
            // Create writer
            if (charset != null && charset != "") {
                let encoding = StrUtil.toEncoding(charset)
                bytes = Buffer.from(content, encoding)
            }
            else {
                bytes = Buffer.from(content);
            }
            tur.res.headers.setContentLength(bytes.length);
        }
        this.sendHeaders(chkId, tur);

        if (bytes != null)
            this.sendResContent(chkId, tur, bytes, 0, bytes.length, null);

        //ship.tourEnded();

    }

}