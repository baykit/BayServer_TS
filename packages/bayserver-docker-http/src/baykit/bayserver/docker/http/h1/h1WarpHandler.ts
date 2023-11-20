import {H1ProtocolHandler} from "./h1ProtocolHandler";
import {WarpHandler} from "bayserver-core/baykit/bayserver/docker/warp/warpHandler";
import {ProtocolHandlerFactory} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerFactory";
import {H1Command} from "./h1Command";
import {H1Packet} from "./h1Packet";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {CmdContent} from "./command/cmdContent";
import {CmdHeader} from "./command/cmdHeader";
import {WarpData} from "bayserver-core/baykit/bayserver/docker/warp/warpData";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {WarpShip} from "bayserver-core/baykit/bayserver/docker/warp/warpShip";
import {CmdEndContent} from "./command/cmdEndContent";
import {Sink} from "bayserver-core/baykit/bayserver/sink";
import {HttpHeaders} from "bayserver-core/baykit/bayserver/util/httpHeaders";
import {DataConsumeListener} from "bayserver-core/baykit/bayserver/util/dataConsumeListener";

export class H1WarpHandler_ProtocolHandlerFactory implements ProtocolHandlerFactory<H1Command , H1Packet> {
    createProtocolHandler(pktStore: PacketStore<H1Packet>): ProtocolHandler<H1Command, H1Packet> {
        return new H1WarpHandler(pktStore)
    }

}

export class H1WarpHandler extends H1ProtocolHandler implements WarpHandler {

    static readonly STATE_READ_HEADER: number = 1
    static readonly STATE_READ_CONTENT: number = 2
    static readonly STATE_FINISHED: number = 3

    static readonly FIXED_WARP_ID: number = 1

    state: number

    constructor(pktStore: PacketStore<H1Packet>) {
        super(pktStore, false);
        this.resetState()
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////


    reset() {
        super.reset();
        this.resetState();
    }

    //////////////////////////////////////////////////////
    // Implements H1CommandHandler
    //////////////////////////////////////////////////////

    handleHeader(cmd: CmdHeader): number {
        let wsip = this.getWarpShip();
        let tur = wsip.getTour(H1WarpHandler.FIXED_WARP_ID);
        let wdat = WarpData.get(tur);
        BayLog.debug("%s handleHeader status=%d", wdat, cmd.status);
        wsip.keeping = false;
        if (this.state == H1WarpHandler.STATE_FINISHED)
            this.changeState(H1WarpHandler.STATE_READ_HEADER);

        if (this.state != H1WarpHandler.STATE_READ_HEADER)
            throw new ProtocolException("Header command not expected");

        if(BayServer.harbor.isTraceHeader()) {
            BayLog.info("%s warp_http: resStatus: %d", wdat, cmd.status);
        }

        for(const nv of cmd.headers) {
            tur.res.headers.add(nv[0], nv[1]);
            if (BayServer.harbor.isTraceHeader()) {
                BayLog.info("%s warp_http: resHeader: %s=%s", wdat, nv[0], nv[1]);
            }
        }

        tur.res.headers.status = cmd.status;
        let resContLen = tur.res.headers.contentLength();
        tur.res.sendHeaders(Tour.TOUR_ID_NOCHECK);
        //BayLog.debug(wdat + " contLen in header=" + resContLen);
        if (resContLen == 0 || cmd.status == HttpStatus.NOT_MODIFIED) {
            this.endResContent(tur);
        } else {
            this.changeState(H1WarpHandler.STATE_READ_CONTENT);
            let sid = wsip.id();
            tur.res.setConsumeListener((len, resume) => {
                if(resume) {
                    wsip.resume(sid);
                }
            });
        }
        return NextSocketAction.CONTINUE;
    }



    handleContent(cmd: CmdContent): number {
        let tur = this.getWarpShip().getTour(H1WarpHandler.FIXED_WARP_ID);
        let wdat = WarpData.get(tur);
        BayLog.debug("%s handleContent len=%d posted=%d contLen=%d", wdat, cmd.len, tur.res.bytesPosted, tur.res.bytesLimit);

        if (this.state != H1WarpHandler.STATE_READ_CONTENT)
            throw new ProtocolException("Content command not expected");


        let available = tur.res.sendContent(Tour.TOUR_ID_NOCHECK, cmd.buffer, cmd.start, cmd.len);
        if (tur.res.bytesPosted == tur.res.bytesLimit) {
            this.endResContent(tur);
            return NextSocketAction.CONTINUE;
        }
        else if(!available) {
            return NextSocketAction.SUSPEND;
        }
        else {
            return NextSocketAction.CONTINUE;
        }
    }

    handleEndContent(cmdEndContent: CmdEndContent): number {
        throw new Sink()
    }

    reqFinished(): boolean {
        return this.state == H1WarpHandler.STATE_FINISHED;
    }

    //////////////////////////////////////////////////////
    // Implements WarpHandler
    //////////////////////////////////////////////////////

    nextWarpId(): number {
        return H1WarpHandler.FIXED_WARP_ID;
    }

    newWarpData(warpId: number): WarpData {
        return new WarpData(this.getWarpShip(), warpId);
    }

    postWarpHeaders(tur: Tour): void {
        let town = tur.town;

        //BayServer.debug(this + " construct header");
        let townPath = town.getName();
        if (!townPath.endsWith("/"))
            townPath += "/";

        let sip = this.getWarpShip();
        let newUri = sip.getDocker().warpBase + tur.req.uri.substring(townPath.length);

        let cmd =
            CmdHeader.newReqHeader(
                tur.req.method,
                newUri,
                "HTTP/1.1")

        for(const name of tur.req.headers.names()) {
            for(const value of tur.req.headers.values(name)) {
                cmd.add(name, value)
            }
        }

        if(tur.req.headers.contains(HttpHeaders.X_FORWARDED_FOR))
            cmd.set(HttpHeaders.X_FORWARDED_FOR, tur.req.headers.get(HttpHeaders.X_FORWARDED_FOR));
        else
            cmd.set(HttpHeaders.X_FORWARDED_FOR, tur.req.remoteAddress);

        if(tur.req.headers.contains(HttpHeaders.X_FORWARDED_PROTO))
            cmd.set(HttpHeaders.X_FORWARDED_PROTO, tur.req.headers.get(HttpHeaders.X_FORWARDED_PROTO));
        else
            cmd.set(HttpHeaders.X_FORWARDED_PROTO, tur.isSecure ? "https" : "http");

        if(tur.req.headers.contains(HttpHeaders.X_FORWARDED_PORT))
            cmd.set(HttpHeaders.X_FORWARDED_PORT, tur.req.headers.get(HttpHeaders.X_FORWARDED_PORT));
        else
            cmd.set(HttpHeaders.X_FORWARDED_PORT, tur.req.serverPort.toString())

        if(tur.req.headers.contains(HttpHeaders.X_FORWARDED_HOST))
            cmd.set(HttpHeaders.X_FORWARDED_HOST, tur.req.headers.get(HttpHeaders.X_FORWARDED_HOST));
        else
            cmd.set(HttpHeaders.X_FORWARDED_HOST, tur.req.headers.get(HttpHeaders.HOST));

        cmd.set(HttpHeaders.HOST, sip.getDocker().host + ":" + sip.getDocker().port);
        cmd.set(HttpHeaders.CONNECTION, "Keep-Alive");

        if(BayServer.harbor.isTraceHeader()) {
            for(const kv of cmd.headers) {
                BayLog.info("%s warp_http reqHdr: %s=%s", tur, kv[0], kv[1])
            }
        }

        this.getWarpShip().post(cmd);
    }

    postWarpContents(tur: Tour, buf: Buffer, start: number, len: number, lis: DataConsumeListener): void {
        let newBuf = Buffer.alloc(len)
        buf.copy(newBuf, 0, start, start + len)
        let cmd = new CmdContent(newBuf, 0, len);
        this.getWarpShip().post(cmd, lis);
    }

    postWarpEnd(tur: Tour): void {
        let cmd = new CmdContent(Buffer.alloc(0), 0, 0)
        let callback = () => {
            this.ship.agent.nonBlockingHandler.askToRead(this.ship.ch)
        }

        this.getWarpShip().post(cmd, callback)
    }

    verifyProtocol(protocol: string): void {
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    private resetState() {
        this.changeState(H1WarpHandler.STATE_FINISHED)
    }

    private endResContent(tur: Tour): void {
        this.getWarpShip().endWarpTour(tur);
        tur.res.endContent(Tour.TOUR_ID_NOCHECK);
        this.resetState();
        this.getWarpShip().keeping = true;
    }

    private changeState(newState: number) {
        this.state = newState
    }

    private getWarpShip() {
        return this.ship as WarpShip
    }


}
