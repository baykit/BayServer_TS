import {FcgCommand} from "./fcgCommand";
import {FcgPacket} from "./fcgPacket";
import {ProtocolHandlerFactory} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerFactory";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {FcgProtocolHandler} from "./fcgProtocolHandler";
import {SimpleBuffer} from "bayserver-core/baykit/bayserver/util/simpleBuffer";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {DataConsumeListener} from "bayserver-core/baykit/bayserver/util/dataConsumeListener";
import {CmdBeginRequest} from "./command/cmdBeginRequest";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {CmdEndRequest} from "./command/cmdEndRequest";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {CmdParams} from "./command/cmdParams";
import {CmdStdErr} from "./command/cmdStdErr";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {CmdStdIn} from "./command/cmdStdIn";
import {CmdStdOut} from "./command/cmdStdOut";
import {Sink} from "bayserver-core/baykit/bayserver/sink";
import {HttpHeaders} from "bayserver-core/baykit/bayserver/util/httpHeaders";
import {CharUtil} from "bayserver-core/baykit/bayserver/util/charUtil";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {FcgWarpDocker} from "./fcgWarpDocker";
import {IOException} from "bayserver-core/baykit/bayserver/util/ioException";
import {CGIUtil} from "bayserver-core/baykit/bayserver/util/CGIUtil";
import {FcgParams} from "./FcgParams";
import {FcgCommandUnPacker} from "./fcgCommandUnPacker";
import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {FcgPacketUnpacker} from "./fcgPacketUnpacker";
import {PacketPacker} from "bayserver-core/baykit/bayserver/protocol/packetPacker";
import {CommandPacker} from "bayserver-core/baykit/bayserver/protocol/commandPacker";
import {WarpHandler} from "bayserver-core/baykit/bayserver/common/warpHandler";
import {FcgHandler} from "./fcgHandler";
import {WarpData} from "bayserver-core/baykit/bayserver/common/warpData";
import {WarpShip} from "bayserver-core/baykit/bayserver/common/warpShip";

export class FcgWarpHandler_ProtocolHandlerFactory implements ProtocolHandlerFactory<FcgCommand, FcgPacket> {

    createProtocolHandler(pktStore: PacketStore<FcgPacket>): ProtocolHandler<FcgCommand, FcgPacket> {
        let warpHandler = new FcgWarpHandler()
        let commandUnpacker = new FcgCommandUnPacker(warpHandler)
        let packetUnpacker: PacketUnpacker<FcgPacket> = new FcgPacketUnpacker(pktStore, commandUnpacker)
        let packetPacker: PacketPacker<FcgPacket> = new PacketPacker<FcgPacket>()
        let commandPacker: CommandPacker<FcgCommand, FcgPacket, any> = new CommandPacker(packetPacker, pktStore)
        let protocolHandler =
            new FcgProtocolHandler(
                warpHandler,
                packetUnpacker,
                packetPacker,
                commandUnpacker,
                commandPacker,
                false
            )
        warpHandler.init(protocolHandler)
        return protocolHandler;
    }
}

export class FcgWarpHandler implements WarpHandler, FcgHandler {

    curWarpId: number = 0

    STATE_READ_HEADER: number = 1
    STATE_READ_CONTENT: number = 2

    protocolHandler: FcgProtocolHandler
    state: number
    lineBuf: SimpleBuffer = new SimpleBuffer()

    pos: number
    last: number
    data: Buffer

    constructor() {
        this.resetState()
    }

    init(ph: FcgProtocolHandler) {
        this.protocolHandler = ph
    }

    //////////////////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////////////////

    reset() : void {
        this.resetState();
        this.lineBuf.reset();
        this.pos = 0;
        this.last = 0;
        this.data = null;
        this.curWarpId++;
    }

    //////////////////////////////////////////////////////////////////
    // Implements WarpHandler
    //////////////////////////////////////////////////////////////////

    nextWarpId(): number {
        return ++this.curWarpId;
    }

    newWarpData(warpId: number): WarpData {
        return new WarpData(this.ship(), warpId);
    }

    sendReqHeaders(tur: Tour): void {
        this.sendBeginReq(tur);
        this.sendParams(tur);
    }

    sendReqContent(tur: Tour, buf: Buffer, start: number, len: number, lis: DataConsumeListener): void {
        this.sendStdIn(tur, buf, start, len, lis);
    }

    sendEndReq(tur: Tour, keepAlive: boolean, lis: DataConsumeListener): void {
        this.sendStdIn(tur, null, 0, 0, lis);
    }

    verifyProtocol(protocol: string): void {
    }

    onProtocolError(e: ProtocolException): boolean {
        throw new Sink()
    }

    //////////////////////////////////////////////////////////////////
    // Implements FcgCommandHandler
    //////////////////////////////////////////////////////////////////

    handleBeginRequest(cmd: CmdBeginRequest): number {
        throw new ProtocolException("Invalid FCGI command: " + cmd.type);
    }

    handleEndRequest(cmd: CmdEndRequest): number {
        let tur = this.ship().getTour(cmd.reqId);
        this.endReqContent(tur);
        return NextSocketAction.CONTINUE;
    }

    handleParams(cmd: CmdParams): number {
        throw new ProtocolException("Invalid FCGI command: " + cmd.type);
    }

    handleStdErr(cmd: CmdStdErr): number {
        let msg = StrUtil.fromBytes(cmd.data, cmd.start, cmd.length);
        BayLog.error(this + " server error:" + msg);
        return NextSocketAction.CONTINUE;
    }

    handleStdIn(cmd: CmdStdIn): number {
        throw new ProtocolException("Invalid FCGI command: " + cmd.type);
    }

    handleStdOut(cmd: CmdStdOut): number {
        let tur = this.ship().getTour(cmd.reqId);
        if(tur == null)
            throw new Sink("Tour not found");

        if (cmd.length == 0) {
            // stdout end
            this.resetState();
            return NextSocketAction.CONTINUE;
        }

        this.data = cmd.data;
        this.pos = cmd.start;
        this.last = cmd.start + cmd.length;

        if (this.state == this.STATE_READ_HEADER)
            this.readHeader(tur);

        if (this.pos < this.last) {
            if (this.state == this.STATE_READ_CONTENT) {
                let available = tur.res.sendResContent(Tour.TOUR_ID_NOCHECK, this.data, this.pos, this.last - this.pos);
                if(!available)
                    return NextSocketAction.SUSPEND;
            }
        }

        return NextSocketAction.CONTINUE;
    }


    //////////////////////////////////////////////////////////////////
    // private methods
    //////////////////////////////////////////////////////////////////

    private readHeader(tur: Tour) : void {
        let wdat = WarpData.get(tur);

        let headerFinished = this.parseHeader(wdat.resHeaders);
        if (headerFinished) {

            wdat.resHeaders.copyTo(tur.res.headers);

            // Check HTTP Status from headers
            let status = wdat.resHeaders.get(HttpHeaders.STATUS);
            if (!StrUtil.empty(status)) {
                let statusList = status.split(" ");
                try {
                    tur.res.headers.status = parseInt(statusList[0])
                }
                catch(e) {
                    BayLog.error(e);
                    throw new ProtocolException("warp: Status header of server is invalid: " + status);
                }
                tur.res.headers.remove(HttpHeaders.STATUS);
            }

            let sip = this.ship()

            BayLog.debug(sip + " fcgi: read header status=" + status + " contlen=" + wdat.resHeaders.contentLength());
            let sid = sip.id();
            tur.res.setConsumeListener((len, resume) => {
                if(resume) {
                    sip.resumeRead(sid);
                }
            });

            tur.res.sendHeaders(Tour.TOUR_ID_NOCHECK);
            this.changeState(this.STATE_READ_CONTENT);
        }
    }

    private parseHeader(headers: HttpHeaders) : boolean {

        while (true) {
            if (this.pos == this.last) {
                // no byte data
                break;
            }

            let c = this.data[this.pos++];

            if (c == CharUtil.CR_CODE)
                continue;
            else if (c == CharUtil.LF_CODE) {
                let line = StrUtil.fromBytes(this.lineBuf.buf, 0, this.lineBuf.len);
                if (line.length == 0)
                    return true;
                let colonPos = line.indexOf(':');
                if (colonPos < 0)
                    throw new ProtocolException("fcgi: Header line of server is invalid: " + line);
                else {
                    let name = line.substring(0, colonPos).trim()
                    let value = line.substring(colonPos + 1).trim()

                    if (StrUtil.empty(name) || StrUtil.empty(value))
                        throw new ProtocolException("fcgi: Header line of server is invalid: " + line);
                    headers.add(name, value);
                    if (BayServer.harbor.isTraceHeader())
                        BayLog.info("%s fcgi_warp: resHeader: %s=%s", this.ship, name, value);
                }
                this.lineBuf.reset();
            } else {
                this.lineBuf.putByte(c);
            }
        }
        return false;
    }

    private endReqContent(tur: Tour) : void {
        this.ship().endWarpTour(tur, true);
        tur.res.endResContent(Tour.TOUR_ID_NOCHECK);
        this.resetState();
    }

    private resetState() : void {
        this.changeState(this.STATE_READ_HEADER);
    }

    private changeState(newState: number) : void {
        this.state = newState;
    }

    private sendStdIn(tur: Tour, data: Buffer, ofs: number, len: number, lis: DataConsumeListener) : void {
        let cmd = new CmdStdIn(WarpData.get(tur).warpId, data, ofs, len);
        this.ship().post(cmd, lis);
    }

    private sendBeginReq(tur: Tour) : void {
        let cmd = new CmdBeginRequest(WarpData.get(tur).warpId);
        cmd.role = CmdBeginRequest.FCGI_RESPONDER;
        cmd.keepConn = true;
        this.ship().post(cmd);
    }

    private sendParams(tur: Tour) : void {
        let dkr = this.ship().getDocker() as FcgWarpDocker
        let scriptBase =  dkr.scriptBase;
        if(scriptBase == null)
            scriptBase = tur.town.getLocation();

        if(StrUtil.empty(scriptBase)) {
            throw new IOException(tur.town + " scriptBase of fcgi docker or location of town is not specified.");
        }

        let docRoot = dkr.docRoot;
        if(docRoot == null)
            docRoot = tur.town.getLocation();

        if(StrUtil.empty(docRoot)) {
            throw new IOException(tur.town + " docRoot of fcgi docker or location of town is not specified.");
        }

        let warpId = WarpData.get(tur).warpId;
        let cmd = new CmdParams(warpId);

        let scriptFname: string[] = [null]
        CGIUtil.getEnv(tur.town.getName(), docRoot, scriptBase, tur, (name: string, value: string) => {
            if(name == CGIUtil.SCRIPT_FILENAME)
                scriptFname[0] = value;
            else
                cmd.addParam(name, value);
        });

        scriptFname[0] = "proxy:fcgi://" + dkr.host + ":" + dkr.port + scriptFname[0];
        cmd.addParam(CGIUtil.SCRIPT_FILENAME, scriptFname[0]);

        cmd.addParam(FcgParams.CONTEXT_PREFIX, "");
        cmd.addParam(FcgParams.UNIQUE_ID, Date.now().toString());

        if(BayServer.harbor.isTraceHeader()) {
            cmd.params.forEach( kv =>
                BayLog.info("%s fcgi_warp: env: %s=%s", this.ship(), kv[0], kv[1]));
        }

        this.ship().post(cmd);

        let cmdParamsEnd = new CmdParams(warpId);
        this.ship().post(cmdParamsEnd);
    }

    ship(): WarpShip {
        return this.protocolHandler.ship as WarpShip
    }
}


