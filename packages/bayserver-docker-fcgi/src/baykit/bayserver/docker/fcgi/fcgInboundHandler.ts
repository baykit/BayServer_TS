import {InboundHandler} from "bayserver-core/baykit/bayserver/docker/base/inboundHandler";
import {ProtocolHandlerFactory} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerFactory";
import {FcgCommand} from "./fcgCommand";
import {FcgPacket} from "./fcgPacket";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {FcgProtocolHandler} from "./fcgProtocolHandler";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {Symbol} from "bayserver-core/baykit/bayserver/symbol";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {HttpHeaders} from "bayserver-core/baykit/bayserver/util/httpHeaders";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {SimpleBuffer} from "bayserver-core/baykit/bayserver/util/simpleBuffer";
import {HttpUtil} from "bayserver-core/baykit/bayserver/util/httpUtil";
import {CmdStdOut} from "./command/cmdStdOut";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {DataConsumeListener} from "bayserver-core/baykit/bayserver/util/dataConsumeListener";
import {CmdEndRequest} from "./command/cmdEndRequest";
import {IOException} from "bayserver-core/baykit/bayserver/util/ioException";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {InboundShip} from "bayserver-core/baykit/bayserver/docker/base/inboundShip";
import {CmdBeginRequest} from "./command/cmdBeginRequest";
import {BayMessage} from "bayserver-core/baykit/bayserver/bayMessage";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {CmdParams} from "./command/cmdParams";
import {ArrayUtil} from "bayserver-core/baykit/bayserver/util/arrayUtil";
import {HttpException} from "bayserver-core/baykit/bayserver/httpException";
import {ReqContentHandlerUtil} from "bayserver-core/baykit/bayserver/tour/reqContentHandler";
import {CmdStdIn} from "./command/cmdStdIn";
import {CmdStdErr} from "./command/cmdStdErr";
import {CGIUtil} from "bayserver-core/baykit/bayserver/util/CGIUtil";

export class FcgInboundHandler_ProtocolHandlerFactory implements ProtocolHandlerFactory<FcgCommand, FcgPacket> {

    createProtocolHandler(pktStore: PacketStore<FcgPacket>): ProtocolHandler<FcgCommand, FcgPacket> {
        return new FcgInboundHandler(pktStore);
    }
}

export class FcgInboundHandler extends FcgProtocolHandler implements InboundHandler {

    static readonly STATE_READ_BEGIN_REQUEST: number = 1
    static readonly STATE_READ_PARAMS: number = 2
    static readonly STATE_READ_STDIN: number = 3

    static readonly HDR_HTTP_CONNECTION: string = "HTTP_CONNECTION";
    static readonly DUMMY_KEY: number = 1

    state: number
    env: Map<string, string> = new Map<string, string>()
    reqId: number
    reqKeepAlive: boolean

    constructor(pktStore: PacketStore<FcgPacket>) {
        super(pktStore, true);
        this.resetState()
    }

    //////////////////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////////////////

    reset() : void {
        super.reset();
        this.resetState();
        this.env.clear()
    }

    //////////////////////////////////////////////////////////////////
    // Implements InboundHandler
    //////////////////////////////////////////////////////////////////

    sendResHeaders(tur: Tour): void {
        BayLog.debug(this.ship + " PH:sendHeaders: tur=" + tur);

        let scode = tur.res.headers.status;
        let status = scode + " " + HttpStatus.description(scode);
        tur.res.headers.set(HttpHeaders.STATUS, status);

        if(BayServer.harbor.isTraceHeader()) {
            BayLog.info(tur + " resStatus:" + tur.res.headers.status);
            for(const name of tur.res.headers.names()) {
                for (const value of tur.res.headers.values(name))
                    BayLog.info(tur + " resHeader:" + name + "=" + value)
            }
        }

        let buf = new SimpleBuffer()
        HttpUtil.sendMimeHeaders(tur.res.headers, buf);
        HttpUtil.sendNewLine(buf);
        let cmd = new CmdStdOut(tur.req.key, buf.buf, 0, buf.len);
        this.commandPacker.post(tur.ship, cmd);
    }

    sendResContent(tur: Tour, bytes: Buffer, ofs: number, len: number, lis: DataConsumeListener): void {
        let cmd = new CmdStdOut(tur.req.key, bytes, ofs, len);
        this.commandPacker.post(this.ship, cmd, lis);
    }

    sendEndTour(tur: Tour, keepAlive: boolean, lis: DataConsumeListener): void {

        BayLog.debug("%s PH:endTour: tur=%s keep=%s", this.ship, tur, keepAlive);

        // Send empty stdout command
        let cmd: FcgCommand = new CmdStdOut(tur.req.key);
        this.commandPacker.post(this.ship, cmd);

        // Send end request command
        cmd = new CmdEndRequest(tur.req.key);
        let ensureFunc = () => {
            if(!keepAlive)
                this.commandPacker.end(this.ship);
        };

        try {
            this.commandPacker.post(this.ship, cmd, () => {
                BayLog.debug("%s call back in sendEndTour: tur=%s keep=%b", this.ship, tur, keepAlive);
                ensureFunc();
                lis();
            });
        }
        catch(e) {
            if(e instanceof IOException) {
                BayLog.debug("%s post faile in sendEndTour: tur=%s keep=%b", this.ship, tur, keepAlive);
                ensureFunc();
            }
            throw e;
        }

    }

    sendReqProtocolError(e: ProtocolException): boolean {
        let ibShip = this.ship as InboundShip
        let tur = ibShip.getErrorTour();
        tur.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.BAD_REQUEST, e.message, e);
        return true;
    }

    //////////////////////////////////////////////////////////////////
    // Implements FcgCommandHandler
    //////////////////////////////////////////////////////////////////

    handleBeginRequest(cmd: CmdBeginRequest): number {
        let sip = this.ship as InboundShip;
        if (BayLog.isDebug())
            BayLog.debug(sip + " handleBeginRequest reqId=" + cmd.reqId + " keep=" + cmd.keepConn);

        if(this.state != FcgInboundHandler.STATE_READ_BEGIN_REQUEST)
            throw new ProtocolException("fcgi: Invalid command: " + cmd.type + " state=" + this.state);

        this.checkReqId(cmd.reqId);

        this.reqId = cmd.reqId;
        let tur = sip.getTour(cmd.reqId);
        if(tur == null) {
            BayLog.error(BayMessage.get(Symbol.INT_NO_MORE_TOURS));
            tur = sip.getTour(cmd.reqId, true);
            tur.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.SERVICE_UNAVAILABLE, "No available tours");
            return NextSocketAction.CONTINUE;
        }

        this.reqKeepAlive = cmd.keepConn;

        this.changeState(FcgInboundHandler.STATE_READ_PARAMS);
        return NextSocketAction.CONTINUE;
    }

    handleEndRequest(cmd: CmdEndRequest): number {
        throw new ProtocolException("Invalid FCGI command: " + cmd.type);
    }

    handleParams(cmd: CmdParams): number {
        let sip = this.ship as InboundShip
        if (BayLog.isDebug())
            BayLog.debug(sip + " handleParams reqId=" + cmd.reqId + " nParams=" + cmd.params.length);

        if(this.state != FcgInboundHandler.STATE_READ_PARAMS)
            throw new ProtocolException("fcgi: Invalid command: " + cmd.type + " state=" + this.state);

        this.checkReqId(cmd.reqId);

        let tur = sip.getTour(cmd.reqId);

        if(ArrayUtil.empty(cmd.params)) {
            // Header completed

            // check keep-alive
            //  keep-alive flag of BeginRequest has high priority
            if (this.reqKeepAlive) {
                if (!tur.req.headers.contains(HttpHeaders.CONNECTION))
                    tur.req.headers.set(HttpHeaders.CONNECTION, "Keep-Alive");
            }
            else {
                tur.req.headers.set(HttpHeaders.CONNECTION, "Close");
            }

            let reqContLen = tur.req.headers.contentLength();

            // end params
            if (BayLog.isDebug())
                BayLog.debug(tur + " read header method=" + tur.req.method + " protocol=" + tur.req.protocol + " uri=" + tur.req.uri + " contlen=" + reqContLen);
            if (BayServer.harbor.isTraceHeader()) {
                for (const name of tur.req.headers.names()) {
                    for(const value of tur.req.headers.values(name)) {
                        BayLog.info("%s  reqHeader: %s=%s", tur, name, value);
                    }
                }
            }

            if(reqContLen > 0) {
                let sid = this.ship.shipId;
                tur.req.setConsumeListener(reqContLen, (len, resume) => {
                    if (resume)
                        sip.resume(sid);
                });
            }

            this.changeState(FcgInboundHandler.STATE_READ_STDIN);
            try {
                this.startTour(tur);

                return NextSocketAction.CONTINUE;

            } catch (e) {
                if(e instanceof HttpException) {
                    BayLog.debug(this + " Http error occurred: " + e);
                    if (reqContLen <= 0) {
                        // no post data
                        tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, e);

                        this.changeState(FcgInboundHandler.STATE_READ_STDIN); // next: read empty stdin command
                        return NextSocketAction.CONTINUE;
                    } else {
                        // Delay send
                        this.changeState(FcgInboundHandler.STATE_READ_STDIN);
                        tur.error = e;
                        tur.req.setContentHandler(ReqContentHandlerUtil.devNull);
                        return NextSocketAction.CONTINUE;
                    }
                }
                else {
                    throw e
                }
            }
        }
        else {
            if (BayServer.harbor.isTraceHeader()) {
                BayLog.info("%s Read FcgiParam", tur);
            }
            for (const [name, value] of cmd.params) {

                if (BayServer.harbor.isTraceHeader()) {
                    BayLog.info("%s  param: %s=%s", tur, name, value);
                }
                this.env.set(name, value);

                if (name.startsWith("HTTP_")) {
                    let hname = name.substring(5);
                    tur.req.headers.add(hname, value);
                } else if (name == "CONTENT_TYPE") {
                    tur.req.headers.add(HttpHeaders.CONTENT_TYPE, value);
                } else if (name == "CONTENT_LENGTH") {
                    tur.req.headers.add(HttpHeaders.CONTENT_LENGTH, value);
                } else if (name == "HTTPS") {
                    tur.isSecure = value.toLowerCase() == "on";
                }
            }

            tur.req.uri = this.env.get("REQUEST_URI");
            tur.req.protocol = this.env.get("SERVER_PROTOCOL");
            tur.req.method = this.env.get("REQUEST_METHOD");

            BayLog.debug(sip + " read params method=" + tur.req.method + " protocol=" + tur.req.protocol + " uri=" + tur.req.uri + " contlen=" + tur.req.headers.contentLength());

            return NextSocketAction.CONTINUE;
        }
    }

    handleStdErr(cmd: CmdStdErr): number {
        throw new ProtocolException("Invalid FCGI command: " + cmd.type);
    }

    handleStdIn(cmd: CmdStdIn): number {
        let sip = this.ship as InboundShip
        BayLog.debug(sip + " handleStdIn reqId=" + cmd.reqId + " len=" + cmd.length);

        if(this.state != FcgInboundHandler.STATE_READ_STDIN)
            throw new ProtocolException("fcgi: Invalid FCGI command: " + cmd.type + " state=" + this.state);

        this.checkReqId(cmd.reqId);

        let tur = sip.getTour(cmd.reqId);
        if(cmd.length == 0) {
            // request content completed

            if(tur.error != null){
                // Error has occurred on header completed

                tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, tur.error);
                this.resetState();
                return NextSocketAction.WRITE;
            }
            else {
                try {
                    this.endReqContent(Tour.TOUR_ID_NOCHECK, tur);
                    return NextSocketAction.CONTINUE;
                } catch (e) {
                    if(e instanceof HttpException) {
                        tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, e);
                        return NextSocketAction.WRITE;
                    }
                    throw e
                }
            }
        }
        else {
            let success = tur.req.postContent(Tour.TOUR_ID_NOCHECK, cmd.data, cmd.start, cmd.length);
            //if(tur.reqBytesRead == contLen)
            //    endContent(tur);

            if (!success)
                return NextSocketAction.SUSPEND;
            else
                return NextSocketAction.CONTINUE;
        }
    }

    handleStdOut(cmd: CmdStdOut): number {
        throw new ProtocolException("Invalid FCGI command: " + cmd.type);
    }


    //////////////////////////////////////////////////////////////////
    // private methods
    //////////////////////////////////////////////////////////////////

    private resetState() : void {
        this.changeState(FcgInboundHandler.STATE_READ_BEGIN_REQUEST);
        this.reqId = FcgPacket.FCGI_NULL_REQUEST_ID
    }

    private changeState(newState: number) : void {
        this.state = newState;
    }

    private endReqContent(checkId: number, tur: Tour) : void {
        tur.req.endContent(checkId);
        this.resetState();
    }

    private checkReqId(receivedId: number): void {
        if (receivedId == FcgPacket.FCGI_NULL_REQUEST_ID)
            throw new ProtocolException("Invalid request id: " + receivedId);

        if (this.reqId == FcgPacket.FCGI_NULL_REQUEST_ID)
            this.reqId = receivedId;

        if (this.reqId != receivedId) {
            BayLog.error(this.ship + " invalid request id: received=" + receivedId + " reqId=" + this.reqId);
            throw new ProtocolException("Invalid request id: " + receivedId);
        }
    }

    private startTour(tur: Tour) : void {
        HttpUtil.parseHostPort(tur, tur.isSecure ? 443 : 80);
        HttpUtil.parseAuthrization(tur);

        tur.req.remotePort = parseInt(this.env.get(CGIUtil.REMOTE_PORT))
        tur.req.remoteAddress = this.env.get(CGIUtil.REMOTE_ADDR);
        tur.req.remoteHostFunc = () => HttpUtil.resolveHost(tur.req.remoteAddress)

        tur.req.serverName = this.env.get(CGIUtil.SERVER_NAME);
        tur.req.serverAddress = this.env.get(CGIUtil.SERVER_ADDR);
        try {
            tur.req.serverPort = parseInt(this.env.get(CGIUtil.SERVER_PORT));
        }
        catch(e) {
            BayLog.error(e);
            tur.req.serverPort = 80;
        }

        tur.go();
    }

}

