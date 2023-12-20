import {InboundHandler} from "bayserver-core/baykit/bayserver/docker/base/inboundHandler";
import {AjpProtocolHandler} from "./ajpProtocolHandler";
import {ProtocolHandlerFactory} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerFactory";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {AjpCommand} from "./ajpCommand";
import {AjpPacket} from "./ajpPacket";
import {CmdForwardRequest} from "./command/cmdForwardRequest";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {CmdSendHeaders} from "./command/cmdSendHeaders";
import {DataConsumeListener} from "bayserver-core/baykit/bayserver/util/dataConsumeListener";
import {CmdSendBodyChunk} from "./command/cmdSendBodyChunk";
import {Symbol} from "bayserver-core/baykit/bayserver/symbol";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {CmdEndResponse} from "./command/cmdEndResponse";
import {IOException} from "bayserver-core/baykit/bayserver/util/ioException";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {InboundShip} from "bayserver-core/baykit/bayserver/docker/base/inboundShip";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {BayMessage} from "bayserver-core/baykit/bayserver/bayMessage";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {HttpException} from "bayserver-core/baykit/bayserver/httpException";
import {ReqContentHandlerUtil} from "bayserver-core/baykit/bayserver/tour/reqContentHandler";
import {CmdData} from "./command/cmdData";
import {CmdGetBodyChunk} from "./command/cmdGetBodyChunk";
import {CmdShutdown} from "./command/cmdShutdown";
import {GrandAgentMonitor} from "bayserver-core/baykit/bayserver/agent/grandAgentMonitor";
import {HttpUtil} from "bayserver-core/baykit/bayserver/util/httpUtil";

export class AjpInboundHandler_ProtocolHandlerFactory implements ProtocolHandlerFactory<AjpCommand, AjpPacket> {

    createProtocolHandler(pktStore: PacketStore<AjpPacket>): ProtocolHandler<AjpCommand, AjpPacket> {
        return new AjpInboundHandler(pktStore);
    }
}

export class AjpInboundHandler extends AjpProtocolHandler implements InboundHandler {

    static readonly STATE_READ_FORWARD_REQUEST: number = 1
    static readonly STATE_READ_DATA: number = 2

    static readonly DUMMY_KEY: number = 1

    curTourId: number
    reqCommand: CmdForwardRequest

    state: number
    keeping: boolean

    constructor(pktStore: PacketStore<AjpPacket>) {
        super(pktStore, true);
        this.resetState()
    }

    //////////////////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////////////////

    reset() : void {
        super.reset();
        this.resetState();
        this.reqCommand = null;
        this.keeping = false;
        this.curTourId = 0;
    }

    //////////////////////////////////////////////////////////////////
    // Implements InboundHandler
    //////////////////////////////////////////////////////////////////

    sendResHeaders(tur: Tour): void {
        let chunked = false;
        let cmd = new CmdSendHeaders();
        for(const name of tur.res.headers.names()) {
            for(const value of tur.res.headers.values(name)) {
                cmd.addHeader(name, value);
            }
        }
        cmd.setStatus(tur.res.headers.status);
        this.commandPacker.post(this.ship, cmd);
    }

    sendResContent(tur: Tour, bytes: Buffer, ofs: number, len: number, lis: DataConsumeListener): void {
        let cmd = new CmdSendBodyChunk(bytes, ofs, len);
        this.commandPacker.post(this.ship, cmd, lis);
    }

    sendEndTour(tur: Tour, keepAlive: boolean, lis: DataConsumeListener): void {
        BayLog.debug(this.ship + " endTour: tur=" + tur + " keep=" + keepAlive);
        let cmd = new CmdEndResponse();
        cmd.reuse = keepAlive;

        let ensureFunc = () => {
            if (!keepAlive)
                this.commandPacker.end(this.ship);
        };

        try {
            this.commandPacker.post(this.ship, cmd, () => {
                BayLog.debug(this.ship + " call back in sendEndTour: tur=" + tur + " keep=" + keepAlive);
                ensureFunc();
                lis();
            });
        }
        catch(e) {
            if(e instanceof IOException) {
                BayLog.debug(this.ship + " post failed in sendEndTour: tur=" + tur + " keep=" + keepAlive);
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
    // Implements AjpCommandHandler
    //////////////////////////////////////////////////////////////////

    handleForwardRequest(cmd: CmdForwardRequest): number {
        let sip = this.ship as InboundShip;
        BayLog.debug("%s handleForwardRequest method=%s uri=%s", sip, cmd.method, cmd.reqUri);

        if(this.state != AjpInboundHandler.STATE_READ_FORWARD_REQUEST)
            throw new ProtocolException("Invalid AJP command: " + cmd.type);

        this.keeping = false;
        this.reqCommand = cmd;
        let tur = sip.getTour(AjpInboundHandler.DUMMY_KEY);
        if(tur == null) {
            BayLog.error(BayMessage.get(Symbol.INT_NO_MORE_TOURS));
            tur = sip.getTour(AjpInboundHandler.DUMMY_KEY, true);
            tur.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.SERVICE_UNAVAILABLE, "No available tours");
            tur.res.endContent(Tour.TOUR_ID_NOCHECK);
            return NextSocketAction.CONTINUE;
        }

        this.curTourId = tur.id();
        tur.req.uri = cmd.reqUri;
        tur.req.protocol = cmd.protocol;
        tur.req.method = cmd.method;
        cmd.headers.copyTo(tur.req.headers);

        let queryString = cmd.attributes.get("?query_string");
        if (StrUtil.isSet(queryString))
            tur.req.uri += "?" + queryString;

        BayLog.debug(tur + "%s read header method=%s protocol=%s uri=%s contlen=%d",
            tur, tur.req.method, tur.req.protocol, tur.req.uri, tur.req.headers.contentLength());
        if (BayServer.harbor.isTraceHeader()) {
            for (const name of cmd.headers.names()) {
                for(let value of cmd.headers.values(name)) {
                    BayLog.info("%s header: %s=%s", tur, name, value);
                }
            }
        }

        let reqContLen = cmd.headers.contentLength();

        if(reqContLen > 0) {
            let sid = sip.shipId;
            tur.req.setConsumeListener(reqContLen, (len, resume) => {
                if (resume)
                    sip.resume(sid);
            });
        }

        try {
            this.startTour(tur);

            if(reqContLen <= 0) {
                this.endReqContent(tur);
            }
            else {
                this.changeState(AjpInboundHandler.STATE_READ_DATA);
            }
            return NextSocketAction.CONTINUE;

        } catch (e) {
            if(e instanceof HttpException) {
                if (reqContLen <= 0) {
                    tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, e);
                    //tur.zombie = true;
                    this.resetState();
                    return NextSocketAction.WRITE;
                }
                else {
                    // Delay send
                    this.changeState(AjpInboundHandler.STATE_READ_DATA);
                    tur.error = e;
                    tur.req.setContentHandler(ReqContentHandlerUtil.devNull);
                    return NextSocketAction.CONTINUE;
                }
            }
            else
                throw e;
        }
    }

    handleData(cmd: CmdData): number {
        let sip = this.ship as InboundShip;
        BayLog.debug("%s handleData len=%s", sip, cmd.length);

        if(this.state != AjpInboundHandler.STATE_READ_DATA)
            throw new ProtocolException("Invalid AJP command: " + cmd.type + " state=" + this.state);

        let tur = sip.getTour(AjpInboundHandler.DUMMY_KEY);
        let success = tur.req.postContent(Tour.TOUR_ID_NOCHECK, cmd.data, cmd.start, cmd.length);

        if(tur.req.bytesPosted == tur.req.bytesLimit) {
            // request content completed

            if(tur.error != null){
                // Error has occurred on header completed

                tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, tur.error);
                this.resetState();
                return NextSocketAction.WRITE;
            }
            else {
                try {
                    this.endReqContent(tur);
                    return NextSocketAction.CONTINUE;
                } catch (e) {
                    if(e instanceof HttpException) {
                        tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, e);
                        this.resetState();
                        return NextSocketAction.WRITE;
                    }
                    else
                        throw e;
                }
            }
        }
        else {
            let bch = new CmdGetBodyChunk();
            bch.reqLen = tur.req.bytesLimit - tur.req.bytesPosted;
            if(bch.reqLen > AjpPacket.MAX_DATA_LEN) {
                bch.reqLen = AjpPacket.MAX_DATA_LEN;
            }
            this.commandPacker.post(sip, bch);

            if(!success)
                return NextSocketAction.SUSPEND;
            else
                return NextSocketAction.CONTINUE;
        }

    }

    handleEndResponse(cmd: CmdEndResponse): number {
        throw new ProtocolException("Invalid AJP command: " + cmd.type);
    }

    handleSendBodyChunk(cmd: CmdSendBodyChunk): number {
        throw new ProtocolException("Invalid AJP command: " + cmd.type);
    }

    handleSendHeaders(cmd: CmdSendHeaders): number {
        throw new ProtocolException("Invalid AJP command: " + cmd.type);
    }

    handleShutdown(cmd: CmdShutdown): number {
        BayLog.debug(this.ship + " handleShutdown");
        GrandAgentMonitor.shutdownAll();
        return NextSocketAction.CLOSE;
    }

    handleGetBodyChunk(cmd: CmdGetBodyChunk): number {
        throw new ProtocolException("Invalid AJP command: " + cmd.type);
    }

    needData(): boolean {
        return this.state == AjpInboundHandler.STATE_READ_DATA
    }

    //////////////////////////////////////////////////////////////////
    // private methods
    //////////////////////////////////////////////////////////////////

    private resetState() : void {
        this.changeState(AjpInboundHandler.STATE_READ_FORWARD_REQUEST);
    }

    private changeState(newState: number) : void {
        this.state = newState;
    }

    private endReqContent(tur: Tour) : void {
        tur.req.endContent(Tour.TOUR_ID_NOCHECK);
        this.resetState();
    }

    private startTour(tur: Tour) : void {
        HttpUtil.parseHostPort(tur, this.reqCommand.isSsl ? 443 : 80);
        HttpUtil.parseAuthrization(tur);

        let socket = this.ship.ch.socket
        tur.req.remotePort = -1;
        tur.req.remoteAddress = this.reqCommand.remoteAddr;
        tur.req.remoteHostFunc = () =>  this.reqCommand.remoteHost;

        tur.req.serverAddress = socket.localAddress;
        tur.req.serverPort = this.reqCommand.serverPort;
        tur.req.serverName = this.reqCommand.serverName;
        tur.isSecure = this.reqCommand.isSsl;

        tur.go();
    }

}

