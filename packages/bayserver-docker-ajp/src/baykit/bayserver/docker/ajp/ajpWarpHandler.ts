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
import {WarpHandler} from "bayserver-core/baykit/bayserver/docker/warp/warpHandler";
import {WarpData} from "bayserver-core/baykit/bayserver/docker/warp/warpData";
import {WarpShip} from "bayserver-core/baykit/bayserver/docker/warp/warpShip";
import {Buffer} from "buffer";

export class AjpWarpHandler_ProtocolHandlerFactory implements ProtocolHandlerFactory<AjpCommand, AjpPacket> {

    createProtocolHandler(pktStore: PacketStore<AjpPacket>): ProtocolHandler<AjpCommand, AjpPacket> {
        return new AjpWarpHandler(pktStore);
    }
}

export class AjpWarpHandler extends AjpProtocolHandler implements WarpHandler {

    FIXED_WARP_ID: number = 1;

    STATE_READ_HEADER: number = 1
    STATE_READ_CONTENT: number = 2

    state: number
    contReadLen: number

    constructor(pktStore: PacketStore<AjpPacket>) {
        super(pktStore, false);
        this.resetState()
    }

    //////////////////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////////////////

    reset() : void {
        super.reset();
        this.resetState();
        this.contReadLen = 0;
    }

    //////////////////////////////////////////////////////////////////
    // Implements WarpHandler
    //////////////////////////////////////////////////////////////////

    nextWarpId(): number {
        return 1;
    }

    newWarpData(warpId: number): WarpData {
        return new WarpData(this.ship as WarpShip, warpId);
    }

    postWarpHeaders(tur: Tour): void {
        this.sendForwardRequest(tur)
    }

    postWarpContents(tur: Tour, buf: Buffer, start: number, len: number, lis: DataConsumeListener): void {
        this.sendData(tur, buf, start, len, lis);
    }

    postWarpEnd(tur: Tour): void {
        let callback = () => {
            this.ship.agent.nonBlockingHandler.askToRead(this.ship.ch)
        }
        let wsip = this.ship as WarpShip
        wsip.post(null, callback);
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
        let wsip = this.ship as WarpShip
        let tur = wsip.getTour(this.FIXED_WARP_ID);

        if (this.state == this.STATE_READ_HEADER)
            this.endResHeader(tur);

        this.endResContent(tur);
        if(cmd.reuse)
            return NextSocketAction.CONTINUE;
        else
            return NextSocketAction.CLOSE;
    }

    handleSendBodyChunk(cmd: CmdSendBodyChunk): number {
        BayLog.debug(this + " handleBodyChunk");
        let wsip = this.ship as WarpShip
        let tur = wsip.getTour(this.FIXED_WARP_ID);

        if (this.state == this.STATE_READ_HEADER) {

            let sid = wsip.id();
            tur.res.setConsumeListener((len, resume) => {
                if(resume) {
                    wsip.resume(sid);
                }
            });

            this.endResHeader(tur);
        }

        let available = tur.res.sendContent(tur.tourId, cmd.chunk, 0, cmd.length);
        this.contReadLen += cmd.length;
        if(available)
            return NextSocketAction.CONTINUE;
        else
            return NextSocketAction.SUSPEND;
    }

    handleSendHeaders(cmd: CmdSendHeaders): number {
        BayLog.debug(this + " handleSendHeaders");

        let tur = (this.ship as WarpShip).getTour(this.FIXED_WARP_ID);

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
        (this.ship as WarpShip).endWarpTour(tur);
        tur.res.endContent(Tour.TOUR_ID_NOCHECK);
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
        let wsip = this.ship as WarpShip;

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
        let wsip = this.ship as WarpShip

        let newBuf = Buffer.alloc(len)
        data.copy(newBuf, 0, ofs, ofs + len)
        let cmd = new CmdData(newBuf, 0, len);
        cmd.toServer = true;
        wsip.post(cmd, lis);
    }
}


