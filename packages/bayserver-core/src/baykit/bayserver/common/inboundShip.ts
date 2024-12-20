import {Ship} from "../ship/ship";
import {ProtocolHandler} from "../protocol/protocolHandler";
import {Port} from "../docker/port";
import {Counter} from "../util/counter";
import {TourStore} from "../tour/tourStore";
import {Tour} from "../tour/tour";
import {BayServer} from "../bayserver";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {ArrayUtil} from "../util/arrayUtil";
import {HttpHeaders} from "../util/httpHeaders";
import {Buffer} from "buffer";
import {StrUtil} from "../util/strUtil";
import {HttpStatus} from "../util/httpStatus";
import {Rudder} from "../rudder/rudder";
import {Transporter} from "../agent/multiplexer/transporter";
import {NextSocketAction} from "../agent/nextSocketAction";
import {ProtocolException} from "../protocol/protocolException";
import {TourHandler} from "../tour/tourHandler";

export class InboundShip extends Ship {

    portDocker: Port;

    static errCounter: Counter = new Counter(1);
    protocolHandler: ProtocolHandler<any, any>
    needEnd: boolean;
    socketTimeoutSec: number;

    tourStore: TourStore;
    activeTours: Tour[] = []

    public initInbound(
        rd: Rudder,
        agtId: number,
        tp: Transporter,
        portDkr: Port,
        protoHandler: ProtocolHandler<any, any>) {

        super.init(agtId, rd, tp);
        this.portDocker = portDkr;
        this.socketTimeoutSec = portDkr.getTimeoutSec() >= 0 ? portDkr.getTimeoutSec() : BayServer.harbor.getSocketTimeoutSec();
        this.tourStore = TourStore.getStore(agtId);
        this.setProtocolHandler(protoHandler);
    }

    toString(): string {
        return "agt#" + this.agentId + " ship#" + this.shipId + "/" + this.objectId +
            (this.protocolHandler != null ? ("[" + this.protocolHandler.protocol() + "]") : "");
    }

    //////////////////////////////////////////////////////
    // implements Reusable
    //////////////////////////////////////////////////////

    reset() {
        super.reset()
        if (!ArrayUtil.empty(this.activeTours)) {
            throw new Sink("%s There are some running tours", this);
        }
        this.needEnd = false;
    }

    //////////////////////////////////////////////////////
    // implements Ship
    //////////////////////////////////////////////////////

    notifyHandshakeDone(protocol: string): number {
        return NextSocketAction.CONTINUE;
    }

    notifyConnect(): number {
        throw new Sink()
    }

    notifyRead(buf: Buffer): number {
        return this.protocolHandler.bytesReceived(buf)
    }

    notifyEof(): number {
        BayLog.debug("%s EOF detected", this);
        return NextSocketAction.CLOSE
    }

    notifyError(err: Error): void {
        BayLog.debug_e(err, "%s Error notified", this);
    }

    notifyProtocolError(e: ProtocolException): boolean {
        BayLog.debug_e(e, "%s ProtocolError notified", this);
        return this.tourHandler().onProtocolError(e)
    }

    notifyClose(): void {
        BayLog.debug("%s notifyClose", this);

        this.abortTours();

        if(this.activeTours.length > 0) {
            // cannot close because there are some running tours
            BayLog.debug(this + " cannot end ship because there are some running tours (ignore)");
            this.needEnd = true;
        }
        else {
            this.endShip();
        }
    }

    checkTimeout(durationSec: number): boolean {
        var timeout: boolean;
        if(this.socketTimeoutSec <= 0)
            timeout = false;
        else if(this.keeping)
            timeout = durationSec >= BayServer.harbor.getKeepTimeoutSec();
        else
            timeout = durationSec >= this.socketTimeoutSec;

        BayLog.debug("%s Check timeout: dur=%d, timeout=%s, keeping=%s limit=%d keeplim=%d",
            this, durationSec, timeout, this.keeping, this.socketTimeoutSec, BayServer.harbor.getKeepTimeoutSec());
        return timeout;
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    setProtocolHandler(protoHandler: ProtocolHandler<any, any>): void {
        this.protocolHandler = protoHandler;
        protoHandler.ship = this;
        BayLog.debug("%s protocol handler is set", this);
    }

    tourHandler(): TourHandler {
        return this.protocolHandler.commandHandler as Object as TourHandler
    }

    endShip() {
        BayLog.debug("%s endShip", this);
        this.portDocker.returnProtocolHandler(this.agentId, this.protocolHandler);
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

        for(const nv of this.portDocker.getAdditionalHeaders()) {
            tur.res.headers.add(nv[0], nv[1]);
        }
        this.tourHandler().sendResHeaders(tur);
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
            this.tourHandler().sendResContent(tur, buf, ofs, len, lis);
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

        BayLog.info("%s tourHandler=%s", this, this.tourHandler())
        this.tourHandler().sendEndTour(tur, keepAlive, callback);
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