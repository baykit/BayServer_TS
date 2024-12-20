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
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {CmdEndResponse} from "./command/cmdEndResponse";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {CmdData} from "./command/cmdData";
import {CmdGetBodyChunk} from "./command/cmdGetBodyChunk";
import {CmdShutdown} from "./command/cmdShutdown";
import {Buffer} from "buffer";
import {AjpCommandUnPacker} from "./ajpCommandUnPacker";
import {AjpPacketUnpacker} from "./ajpPacketUnpacker";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {AjpCommandHandler} from "./ajpCommandHandler";
import {AjpHandler} from "./ajpHandler";
import {Sink} from "bayserver-core/baykit/bayserver/sink";
import {WarpHandler} from "bayserver-core/baykit/bayserver/common/warpHandler";
import {WarpData} from "bayserver-core/baykit/bayserver/common/warpData";
import {WarpShip} from "bayserver-core/baykit/bayserver/common/warpShip";

export class AjpWarpHandler_ProtocolHandlerFactory implements ProtocolHandlerFactory<AjpCommand, AjpPacket> {

    createProtocolHandler(pktStore: PacketStore<AjpPacket>): ProtocolHandler<AjpCommand, AjpPacket> {
        let warpHandler = new AjpWarpHandler()
        let commandUnpacker = new AjpCommandUnPacker(warpHandler);
        let packetUnpacker = new AjpPacketUnpacker(pktStore, commandUnpacker);
        let packetPacker = new PacketPacker<AjpPacket>();
        let commandPacker = new CommandPacker<AjpCommand, AjpPacket, AjpCommandHandler>(packetPacker, pktStore);
        let protocolHandler =
            new AjpProtocolHandler(
                warpHandler,
                packetUnpacker,
                packetPacker,
                commandUnpacker,
                commandPacker,
                false);
        warpHandler.init(protocolHandler)
        return protocolHandler
    }
}

export class AjpWarpHandler implements WarpHandler, AjpHandler {

    FIXED_WARP_ID: number = 1;

    STATE_READ_HEADER: number = 1
    STATE_READ_CONTENT: number = 2

    protocolHandler: AjpProtocolHandler
    state: number
    contReadLen: number

    constructor() {
        this.resetState()
    }

    init(protoHandler: AjpProtocolHandler): void {
        this.protocolHandler = protoHandler
    }

    //////////////////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////////////////

    reset() : void {
        this.resetState();
        this.contReadLen = 0;
    }

    //////////////////////////////////////////////////////////////////
    // Implements TourHandler
    //////////////////////////////////////////////////////////////////

    sendReqHeaders(tur: Tour): void {
        this.sendForwardRequest(tur)
    }

    sendReqContent(tur: Tour, buf: Buffer, start: number, len: number, lis: DataConsumeListener): void {
        this.sendData(tur, buf, start, len, lis);
    }

    sendEndReq(tur: Tour, keepAlive: boolean, lis: DataConsumeListener): void {
        this.ship().post(null, lis);
    }

    onProtocolError(e: ProtocolException): boolean {
        throw new Sink()
    }


    //////////////////////////////////////////////////////////////////
    // Implements WarpHandler
    //////////////////////////////////////////////////////////////////

    nextWarpId(): number {
        return 1;
    }

    newWarpData(warpId: number): WarpData {
        return new WarpData(this.ship() as WarpShip, warpId);
    }

    verifyProtocol(protocol: string): void {
    }


    //////////////////////////////////////////////////////////////////
    // Implements AjpCommandHandler
    //////////////////////////////////////////////////////////////////

    handleForwardRequest(cmd: CmdForwardRequest): number {
        throw new ProtocolException("Invalid AJP command: " + cmd.type);
    }

    handleData(cmd: CmdData): number {
        throw new ProtocolException("Invalid AJP command: " + cmd.type);
    }

    handleEndResponse(cmd: CmdEndResponse): number {
        BayLog.debug("%s handleEndResponse reuse=%b", this, cmd.reuse);
        let wsip = this.ship()
        let tur = wsip.getTour(this.FIXED_WARP_ID);

        if (this.state == this.STATE_READ_HEADER)
            this.endResHeader(tur);

        this.endResContent(tur);
        if(cmd.reuse)
            return NextSocketAction.CONTINUE;
        else {
            return NextSocketAction.CLOSE;
        }
    }

    handleSendBodyChunk(cmd: CmdSendBodyChunk): number {
        BayLog.debug(this + " handleBodyChunk");
        let wsip = this.ship()
        let tur = wsip.getTour(this.FIXED_WARP_ID);

        if (this.state == this.STATE_READ_HEADER) {

            let sid = wsip.id();
            tur.res.setConsumeListener((len, resume) => {
                if(resume) {
                    wsip.resumeRead(sid);
                }
            });

            this.endResHeader(tur);
        }

        let available = tur.res.sendResContent(tur.tourId, cmd.chunk, 0, cmd.length);
        this.contReadLen += cmd.length;
        if(available)
            return NextSocketAction.CONTINUE;
        else
            return NextSocketAction.SUSPEND;
    }

    handleSendHeaders(cmd: CmdSendHeaders): number {
        BayLog.debug(this + " handleSendHeaders");

        let tur = this.ship().getTour(this.FIXED_WARP_ID);

        if (this.state != this.STATE_READ_HEADER)
            throw new ProtocolException("Invalid AJP command: " + cmd.type + " state=" + this.state);

        let wdata = WarpData.get(tur);

        if(BayServer.harbor.isTraceHeader())
            BayLog.info(wdata + " recv res status: " + cmd.status);
        wdata.resHeaders.status = cmd.status;
        for (const [name, values] of cmd.headers) {
            for (const value of values) {
                if (BayServer.harbor.isTraceHeader())
                    BayLog.info(wdata + " recv res header: " + name + "=" + value);
                wdata.resHeaders.add(name, value);
            }
        }

        return NextSocketAction.CONTINUE;
    }

    handleShutdown(cmd: CmdShutdown): number {
        throw new ProtocolException("Invalid AJP command: " + cmd.type);
    }

    handleGetBodyChunk(cmd: CmdGetBodyChunk): number {
        BayLog.debug(this + " handleGetBodyChunk");
        return NextSocketAction.CONTINUE;
    }

    needData(): boolean {
        return false
    }

    //////////////////////////////////////////////////////////////////
    // private methods
    //////////////////////////////////////////////////////////////////

    private endResHeader(tur: Tour): void {
        let wdat = WarpData.get(tur);
        wdat.resHeaders.copyTo(tur.res.headers);
        tur.res.sendHeaders(Tour.TOUR_ID_NOCHECK);
        this.changeState(this.STATE_READ_CONTENT);
    }

    private endResContent(tur: Tour) : void {
        this.ship().endWarpTour(tur);
        tur.res.endResContent(Tour.TOUR_ID_NOCHECK);
        this.resetState();
    }

    private resetState() : void {
        this.changeState(this.STATE_READ_HEADER);
    }

    private changeState(newState: number) : void {
        this.state = newState;
    }

    private sendForwardRequest(tur: Tour) : void {
        BayLog.debug(tur + " construct header");
        let wsip = this.ship()

        let cmd = new CmdForwardRequest();
        cmd.toServer = true;
        cmd.method = tur.req.method;
        cmd.protocol = tur.req.protocol;
        let relUri = tur.req.rewrittenURI != null ? tur.req.rewrittenURI : tur.req.uri;
        let twnPath = tur.town.getName();
        if(!twnPath.endsWith("/"))
           twnPath += "/";
        relUri = relUri.substring(twnPath.length);
        let reqUri =  wsip.getDocker().warpBase + relUri;

        let pos = reqUri.indexOf('?');
        if(pos >= 0) {
            cmd.reqUri = reqUri.substring(0, pos);
            cmd.attributes.set("?query_string", reqUri.substring(pos + 1));
        }
        else {
            cmd.reqUri = reqUri;
        }
        cmd.remoteAddr = tur.req.remoteAddress;
        cmd.remoteHost = tur.req.remoteHost();
        cmd.serverName = tur.req.serverName;
        cmd.serverPort = tur.req.serverPort;
        cmd.isSsl = tur.isSecure;
        tur.req.headers.copyTo(cmd.headers);
        //cmd.headers.setHeader(Headers.HOST, docker.host + ":" + docker.port);
        //cmd.headers.setHeader(Headers.CONNECTION, "keep-alive");
        cmd.serverPort =  wsip.getDocker().port;

        if(BayServer.harbor.isTraceHeader()) {
            for(const name of cmd.headers.names()) {
                for (const value of cmd.headers.values(name)) {
                    BayLog.info("%s sendWarpHeader: %s=%s", WarpData.get(tur), name, value);
                }
            }
        }
        wsip.post(cmd);
    }

    private sendData(tur: Tour, data: Buffer, ofs: number, len: number, lis: DataConsumeListener) : void {
        BayLog.debug("%s construct contents", tur);
        let wsip = this.ship()

        let newBuf = Buffer.alloc(len)
        data.copy(newBuf, 0, ofs, ofs + len)
        let cmd = new CmdData(newBuf, 0, len);
        cmd.toServer = true;
        wsip.post(cmd, lis);
    }

    ship(): WarpShip {
        return this.protocolHandler.ship as WarpShip
    }

}


