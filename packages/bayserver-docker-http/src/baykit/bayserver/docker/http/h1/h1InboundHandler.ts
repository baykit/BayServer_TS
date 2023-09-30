import {ProtocolHandlerFactory} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerFactory";
import {H1Command} from "./h1Command";
import {H1Packet} from "./h1Packet";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {InboundHandler} from "bayserver-core/baykit/bayserver/docker/base/inboundHandler";
import { ProtocolException } from "bayserver-core/baykit/bayserver/protocol/protocolException";
import { DataConsumeListener } from "bayserver-core/baykit/bayserver/util/dataConsumeListener";
import {H1ProtocolHandler} from "./h1ProtocolHandler";
import { CmdContent } from "./command/cmdContent";
import { CmdEndContent } from "./command/cmdEndContent";
import { CmdHeader } from "./command/cmdHeader";
import {InboundShip} from "bayserver-core/baykit/bayserver/docker/base/inboundShip";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {HtpPortDocker} from "../htpPortDocker";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {HtpDockerConst} from "../htpDockerConst";
import {UpgradeException} from "bayserver-core/baykit/bayserver/agent/upgradeException";
import {BayMessage} from "bayserver-core/baykit/bayserver/bayMessage";
import {Symbol} from "bayserver-core/baykit/bayserver/symbol";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {HttpException} from "bayserver-core/baykit/bayserver/httpException";
import {ReqContentHandlerUtil} from "bayserver-core/baykit/bayserver/tour/reqContentHandler";
import {HttpHeaders} from "bayserver-core/baykit/bayserver/util/httpHeaders";
import {HttpUtil} from "bayserver-core/baykit/bayserver/util/httpUtil";
import {Sink} from "bayserver-core/baykit/bayserver/sink";

export class H1InboundProtocolHandlerFactory implements ProtocolHandlerFactory<H1Command, H1Packet> {

    createProtocolHandler(pktStore: PacketStore<H1Packet>): ProtocolHandler<H1Command, H1Packet> {
        return new H1InboundHandler(pktStore);
    }
}

export class H1InboundHandler extends H1ProtocolHandler implements InboundHandler {


    private static readonly STATE_READ_HEADER: number = 1;
    private static readonly STATE_READ_CONTENT: number = 2;
    private static readonly STATE_FINISHED: number = 3;

    headerRead: boolean ;
    httpProtocol: string;

    state: number;
    curReqId: number = 1;
    curTour: Tour;
    curTourId: number;

    constructor(pktStore: PacketStore<H1Packet>) {
        super(pktStore, true);
        this.resetState();
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////
    reset() {
        super.reset();
        this.resetState();
        this.headerRead = false;
        this.httpProtocol = null;
        this.curReqId = 1;
        this.curTour = null;
        this.curTourId = 0;
    }


    //////////////////////////////////////////////////////
    // Implements InboundHandler
    //////////////////////////////////////////////////////

    sendResHeaders(tur: Tour) {
        var resCon: string;

        // determine Connection header value
        if(tur.req.headers.getConnection() != HttpHeaders.CONNECTION_KEEP_ALIVE)
            // If client doesn't support "Keep-Alive", set "Close"
            resCon = "Close";
        else {
            resCon = "Keep-Alive";
            // Client supports "Keep-Alive"
            if (tur.res.headers.getConnection() != HttpHeaders.CONNECTION_KEEP_ALIVE) {
                // If tour doesn't need "Keep-Alive"
                if (tur.res.headers.contentLength() == -1) {
                    // If content-length not specified
                    if (tur.res.headers.contentType() != null &&
                        tur.res.headers.contentType().startsWith("text/")) {
                        // If content is text, connection must be closed
                        resCon = "Close";
                    }
                }
            }
        }

        tur.res.headers.set(HttpHeaders.CONNECTION, resCon);

        if(BayServer.harbor.isTraceHeader()) {
            BayLog.info("%s resStatus:%d", tur, tur.res.headers.status);
            for(const name of tur.res.headers.names())
                for(const value of tur.res.headers.values(name))
                    BayLog.info("%s resHeader:%s=%s", tur, name, value);
        }

        let cmd: CmdHeader = CmdHeader.newResHeader(tur.res.headers, tur.req.protocol);
        this.commandPacker.post(this.ship, cmd, null);
    }


    sendResContent(tur: Tour, bytes: Buffer, ofs: number, len: number, lis: DataConsumeListener) {
        let cmd = new CmdContent(bytes, ofs, len);
        this.commandPacker.post(this.ship, cmd, lis);
    }

    sendEndTour(tur: Tour, keepAlive: boolean, lis: DataConsumeListener) {
        BayLog.trace("%s sendEndTour: tur=%s keep=%s", this.ship, tur, keepAlive);

        // Send end request command
        let sid = this.ship.shipId
        let ensureFunc = () => {
            if(keepAlive && !this.ship.postman.isZombie()) {
                this.ship.keeping = true;
                this.ship.resume(sid)
            }
            else
                this.commandPacker.end(this.ship);
        };

        let cmd = new CmdEndContent();
        try {
            this.commandPacker.post(this.ship, cmd, () => {
                BayLog.debug("%s call back of end content command: tur=%s", this.ship, tur);
                ensureFunc();
                lis();
            });
        }
        catch(e) {
            //ensureFunc();
            throw e;
        }
    }

    sendReqProtocolError(e: ProtocolException): boolean {
        let tur: Tour;
        if(this.curTour == null)
            tur = this.inboundShip().getErrorTour();
        else
            tur = this.curTour;

        tur.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.BAD_REQUEST, null, e);
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements H1CommandHandler
    //////////////////////////////////////////////////////
    handleHeader(cmd: CmdHeader): number {
        let sip = this.inboundShip()
        BayLog.debug("%s handleHeader: method=%s uri=%s proto=%s", sip, cmd.method, cmd.uri, cmd.version);

        if (this.state == H1InboundHandler.STATE_FINISHED)
            this.changeState(H1InboundHandler.STATE_READ_HEADER);

        if (this.state != H1InboundHandler.STATE_READ_HEADER || this.curTour != null) {
            let msg = "Header command not expected: state=" + this.state + " curTour=" + this.curTour;
            BayLog.error(msg);
            this.resetState();
            throw new ProtocolException(msg);
        }

        // check HTTP2
        let protocol = cmd.version.toUpperCase();
        if (protocol == "HTTP/2.0") {
            let port = sip.portDocker as HtpPortDocker;
            if(port.supportH2) {
                sip.portDocker.returnProtocolHandler(sip.agent, this);
                let newHnd = ProtocolHandlerStore.getStore(HtpDockerConst.H2_PROTO_NAME, true, sip.agent.agentId).rent();
                sip.setProtocolHandler(newHnd);
                throw new UpgradeException();
            }
            else {
                throw new ProtocolException(
                    BayMessage.get(Symbol.HTP_UNSUPPORTED_PROTOCOL, protocol));
            }
        }

        let tur = sip.getTour(this.curReqId)
        BayLog.debug("%s Get tour(reqid=%d): %s", sip, this.curReqId, tur)
        if(!tur.isPreparing())
            throw new Error(tur + " Invalid tour state: " + tur.state)
        if(tur == null) {
            BayLog.error(BayMessage.get(Symbol.INT_NO_MORE_TOURS));
            tur = sip.getTour(this.curReqId, true);
            tur.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.SERVICE_UNAVAILABLE, "No available tours");
            //sip.agent.shutdown(false);
            return NextSocketAction.CONTINUE;
        }
        
        this.curTour = tur;
        this.curTourId = tur.tourId;
        this.curReqId = (this.curReqId + 1) & 0xffffff;  // issue new request id

        sip.keeping = false;

        this.httpProtocol = protocol;

        tur.req.uri = cmd.uri
        tur.req.method = cmd.method.toUpperCase();
        tur.req.protocol = protocol;

        if (!(tur.req.protocol == "HTTP/1.1"
            || tur.req.protocol == "HTTP/1.0"
            || tur.req.protocol == "HTTP/0.9")) {

            throw new ProtocolException(
                BayMessage.get(Symbol.HTP_UNSUPPORTED_PROTOCOL, tur.req.protocol));
        }

        for(const nv of cmd.headers) {
            tur.req.headers.add(nv[0], nv[1]);
        }

        let reqContLen = tur.req.headers.contentLength();
        BayLog.debug("%s contlen=%d", sip, tur.req.headers.contentLength());

        if (BayServer.harbor.isTraceHeader()) {
            for(const item of cmd.headers) {
                BayLog.info(tur + " h1: reqHeader: " + item[0] + "=" + item[1]);
            }
        }

        if(reqContLen > 0) {
            let sid = this.ship.shipId;
            tur.req.setConsumeListener(reqContLen, (len, resume) => {
                if (resume)
                    sip.resume(sid);
            });
        }

        try {

            this.startTour(tur);

            if (reqContLen <= 0) {
                this.endReqContent(this.curTourId, tur);
                return NextSocketAction.SUSPEND; // end reading
            } else {
                this.changeState(H1InboundHandler.STATE_READ_CONTENT);
                return NextSocketAction.CONTINUE;
            }

        } catch (e) {
            if(!(e instanceof HttpException))
                throw e

            BayLog.debug(this + " Http error occurred: " + e);
            if(reqContLen <= 0) {
                // no post data
                tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, e);

                this.resetState(); // next: read empty stdin command
                return NextSocketAction.SUSPEND;
            }
            else {
                // Delay send
                BayLog.trace(this + " error sending is delayed");
                this.changeState(H1InboundHandler.STATE_READ_CONTENT);
                tur.error = e;
                tur.req.setContentHandler(ReqContentHandlerUtil.devNull);
                return NextSocketAction.CONTINUE;
            }
        }
    }

    handleContent(cmd: CmdContent): number {
        BayLog.debug("%s handleContent: len=%s", this.ship, cmd.len);

        if (this.state != H1InboundHandler.STATE_READ_CONTENT) {
            let s = this.state;
            this.resetState();
            throw new ProtocolException("Content command not expected: state=" + s);
        }

        let tur = this.curTour;
        let tourId = this.curTourId;
        let success = tur.req.postContent(tourId, cmd.buffer, cmd.start, cmd.len);

        if (tur.req.bytesPosted == tur.req.bytesLimit) {
            if(tur.error != null){
                // Error has occurred on header completed
                tur.res.sendHttpException(tourId, tur.error);
                this.resetState();
                return NextSocketAction.WRITE;
            }
            else {
                try {
                    this.endReqContent(tourId, tur);
                    return NextSocketAction.SUSPEND;
                } catch (e) {
                    if(!(e instanceof HttpException))
                        throw e
                    else {
                        tur.res.sendHttpException(tourId, e);
                        this.resetState();
                        return NextSocketAction.WRITE;
                    }
                }
            }
        }

        if(!success)
            return NextSocketAction.SUSPEND;
        else
            return NextSocketAction.CONTINUE;
    }

    handleEndContent(cmdEndContent: CmdEndContent): number {
        throw new Sink();
    }

    reqFinished(): boolean {
        return this.state == H1InboundHandler.STATE_FINISHED
    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////
    private endReqContent(chkTurId: number, tur: Tour) : void {
        tur.req.endContent(chkTurId);
        this.resetState();
    }

    startTour(tur: Tour) {
        let secure = this.inboundShip().portDocker.isSecure();
        HttpUtil.parseHostPort(tur, secure ? 443 : 80);
        HttpUtil.parseAuthrization(tur);

        // Get remote address
        let clientAdr = tur.req.headers.get(HttpHeaders.X_FORWARDED_FOR);
        let skt = this.ship.ch.socket;
        if (clientAdr != null) {
            tur.req.remoteAddress = clientAdr;
            tur.req.remotePort = -1;
        }
        else {
            try {
                tur.req.remotePort = skt.remotePort;
                tur.req.remoteAddress = skt.remoteAddress;
            } catch (e) {
                // Unix domain socket
                tur.req.remotePort = -1;
                tur.req.remoteAddress = null;
            }
        }

        // Get server address
        try {
            tur.req.serverAddress = skt.localAddress;
        } catch (e) {
            // Unix domain socket
            tur.req.serverAddress = null;
        }

        // Create closure to get remote host
        tur.req.remoteHostFunc = () => {
            if(tur.req.remoteAddress)
                return HttpUtil.resolveHost(tur.req.remoteAddress);
            else
                return null;
        }

        tur.req.serverPort = tur.req.reqPort;
        tur.req.serverName = tur.req.reqHost;
        tur.isSecure = secure;

        tur.go();
    }

    private changeState(newState: number) {
        this.state = newState;
    }


    private resetState() {
        this.headerRead = false;
        this.changeState(H1InboundHandler.STATE_FINISHED);
        this.curTour = null;
    }

    private inboundShip(): InboundShip {
        return this.ship as InboundShip;
    }
}
