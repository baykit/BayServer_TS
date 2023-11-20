import {H2ProtocolHandler} from "./h2ProtocolHandler";
import {InboundHandler} from "bayserver-core/baykit/bayserver/docker/base/inboundHandler";
import {ProtocolHandlerFactory} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerFactory";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandler} from "bayserver-core/baykit/bayserver/protocol/protocolHandler";
import {H2Command} from "./h2Command";
import {H2Packet} from "./h2Packet";
import {CmdData} from "./command/cmdData";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {HeaderBlockAnalyzer} from "./headerBlockAnalyzer";
import {H2Settings} from "./h2Settings";
import {InboundShip} from "bayserver-core/baykit/bayserver/docker/base/inboundShip";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {CmdHeaders} from "./command/cmdHeaders";
import {HeaderBlockBuilder} from "./headerBlockBuilder";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {DataConsumeListener} from "bayserver-core/baykit/bayserver/util/dataConsumeListener";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {CmdGoAway} from "./command/cmdGoAway";
import {H2ErrorCode} from "./h2ErrorCode";
import {CmdPreface} from "./command/cmdPreface";
import {CmdSettings, CmdSettingsItem} from "./command/cmdSettings";
import {TourStore} from "bayserver-core/baykit/bayserver/tour/tourStore";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {BayMessage} from "bayserver-core/baykit/bayserver/bayMessage";
import {Symbol} from "bayserver-core/baykit/bayserver/symbol";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {HeaderBlock} from "./headerBlock";
import {CmdWindowUpdate} from "./command/cmdWindowUpdate";
import {Ship} from "bayserver-core/baykit/bayserver/watercraft/ship";
import {ReqContentHandlerUtil} from "bayserver-core/baykit/bayserver/tour/reqContentHandler";
import {CmdPriority} from "./command/cmdPriority";
import {H2Flags} from "./h2Flags";
import {CmdPing} from "./command/cmdPing";
import {CmdRstStream} from "./command/cmdRstStream";
import {HttpUtil} from "bayserver-core/baykit/bayserver/util/httpUtil";
import * as net from "net";
import {TourReq} from "bayserver-core/baykit/bayserver/tour/tourReq";

export class H2InboundProtocolHandlerFactory implements ProtocolHandlerFactory<H2Command, H2Packet> {

    createProtocolHandler(pktStore: PacketStore<H2Packet>): ProtocolHandler<H2Command, H2Packet> {
        return new H2InboundHandler(pktStore);
    }
}



export class H2InboundHandler extends H2ProtocolHandler implements InboundHandler {

    headerRead: boolean
    httpProtocol: string

    reqContLen: number
    reqContRead: number
    windowSize = BayServer.harbor.getTourBufferSize()
    readonly settings = new H2Settings()
    readonly analyzer = new HeaderBlockAnalyzer()

    constructor(pktStore: PacketStore<H2Packet>) {
        super(pktStore, true);
    }

    inboundShip(): InboundShip {
        return this.ship as InboundShip
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////
    reset() {
        super.reset();
        this.headerRead = false;

        this.reqContLen = 0;
        this.reqContRead = 0;

    }

    //////////////////////////////////////////////////////
    // Implements InboundHandler
    //////////////////////////////////////////////////////

    sendResHeaders(tur: Tour) {
        let cmd = new CmdHeaders(tur.req.key);

        let bld = new HeaderBlockBuilder();

        let blk = bld.buildHeaderBlock(":status", tur.res.headers.status.toString(), this.resHeaderTbl);
        cmd.headerBlocks.push(blk);

        // headers
        if(BayServer.harbor.isTraceHeader())
            BayLog.info("%s H2 res status: %d", tur, tur.res.headers.status);
        for (const name of tur.res.headers.names()) {
            if(StrUtil.eqIgnoreCase(name, "connection")) {
                BayLog.trace("%s Connection header is discarded", tur);
            }
            else {
                for(const value of tur.res.headers.values(name)) {
                    if (BayServer.harbor.isTraceHeader())
                        BayLog.info("%s H2 res header: %s=%s", tur, name, value);
                    blk = bld.buildHeaderBlock(name, value, this.resHeaderTbl);
                    cmd.headerBlocks.push(blk);
                }
            }
        }

        cmd.flags.setEndHeaders(true);
        cmd.excluded = false;
        // cmd.streamDependency = streamId;
        cmd.flags.setPadded(false);

        this.commandPacker.post(this.ship, cmd);
    }

    sendResContent(tur: Tour, bytes: Buffer, ofs: number, len: number, lis: DataConsumeListener) {
        let cmd = new CmdData(tur.req.key, null, bytes, ofs, len);
        this.commandPacker.post(this.ship, cmd, lis);
    }

    sendEndTour(tur: Tour, keepAlive: boolean, lis: DataConsumeListener) {
        let cmd = new CmdData(tur.req.key, null);
        cmd.flags.setEndStream(true);
        this.commandPacker.post(this.ship, cmd, lis);
    }

    sendReqProtocolError(e: ProtocolException): boolean {
        BayLog.error_e(e);
        let cmd = new CmdGoAway(H2InboundHandler.CTL_STREAM_ID);
        cmd.streamId = 0;
        cmd.lastStreamId = 0;
        cmd.errorCode = H2ErrorCode.PROTOCOL_ERROR;
        cmd.debugData = Buffer.from("Thank you!");
        try {
            this.commandPacker.post(this.ship, cmd);
            this.commandPacker.end(this.ship);
        }
        catch(ex) {
            BayLog.error_e(ex);
        }
        return false;
    }


    //////////////////////////////////////////////////////
    // Implements H2CommandHandler
    //////////////////////////////////////////////////////

    handlePreface(cmd: CmdPreface): number {
        let sip = this.inboundShip()
        BayLog.debug("%s h2: handle_preface: proto=%s", sip, cmd.protocol);

        this.httpProtocol = cmd.protocol;

        let set = new CmdSettings(H2ProtocolHandler.CTL_STREAM_ID);
        set.streamId = 0;
        set.items.push(new CmdSettingsItem(CmdSettings.MAX_CONCURRENT_STREAMS, TourStore.MAX_TOURS));
        set.items.push(new CmdSettingsItem(CmdSettings.INITIAL_WINDOW_SIZE, this.windowSize));
        this.commandPacker.post(sip, set);

        set = new CmdSettings(H2ProtocolHandler.CTL_STREAM_ID);
        set.streamId = 0;
        set.flags.setAck(true);
        //cmdPacker.send(set);

        return NextSocketAction.CONTINUE;
    }

    handleHeaders(cmd: CmdHeaders): number {
        let sip = this.inboundShip()

        BayLog.debug("%s handle_headers: stm=%d dep=%d weight=%d", sip, cmd.streamId, cmd.streamDependency, cmd.weight);
        let tur = this.getTour(cmd.streamId);
        if(tur == null) {
            BayLog.error(BayMessage.get(Symbol.INT_NO_MORE_TOURS));
            tur = sip.getTour(cmd.streamId, true);
            tur.res.sendError(Tour.TOUR_ID_NOCHECK, HttpStatus.SERVICE_UNAVAILABLE, "No available tours");
            //sip.agent.shutdown(false);
            return NextSocketAction.CONTINUE;
        }

        for(const blk of cmd.headerBlocks) {
            if(blk.op == HeaderBlock.UPDATE_DYNAMIC_TABLE_SIZE) {
                BayLog.trace("%s header block update table size: %d", tur, blk.size);
                this.reqHeaderTbl.setSize(blk.size);
                continue;
            }
            this.analyzer.analyzeHeaderBlock(blk, this.reqHeaderTbl);
            if(BayServer.harbor.isTraceHeader())
                BayLog.info("%s req header: %s=%s :%s", tur, this.analyzer.name, this.analyzer.value, blk);

            if(this.analyzer.name == null) {
                continue
            }
            else if(this.analyzer.name.charAt(0) != ':') {
                tur.req.headers.add(this.analyzer.name, this.analyzer.value);
            }
            else if(this.analyzer.method != null) {
                tur.req.method = this.analyzer.method;
            }
            else if(this.analyzer.path != null) {
                tur.req.uri = this.analyzer.path;
            }
            else if(this.analyzer.scheme != null) {
            }
            else if(this.analyzer.status != null) {
                throw new Error("Illegal State");
            }
        }

        if (cmd.flags.endHeaders()) {
            tur.req.protocol = "HTTP/2.0";
            BayLog.debug("%s H2 read header method=%s protocol=%s uri=%s contlen=%d",
                sip, tur.req.method, tur.req.protocol, tur.req.uri, tur.req.headers.contentLength());

            let reqContLen = tur.req.headers.contentLength();

            if(reqContLen > 0) {
                let sid = sip.shipId;

                tur.req.setConsumeListener(reqContLen, (len, resume) => {
                    sip.checkShipId(sid);

                    if (len > 0) {
                        let upd = new CmdWindowUpdate(cmd.streamId);
                        upd.windowSizeIncrement = len;
                        let upd2 = new CmdWindowUpdate(0);
                        upd2.windowSizeIncrement = len;
                        let cmdPacker = this.commandPacker;
                        try {
                            cmdPacker.post(sip, upd);
                            cmdPacker.post(sip, upd2);
                        }
                        catch(e) {
                            BayLog.error_e(e);
                        }
                    }

                    if (resume)
                        sip.resume(Ship.SHIP_ID_NOCHECK);
                });
            }

            try {
                this.startTour(tur);
                if (tur.req.headers.contentLength() <= 0) {
                    this.endReqContent(tur.id(), tur);
                }
            } catch (e) {
                BayLog.debug("%s Http error occurred: %s", this, e);
                if(reqContLen <= 0) {
                    // no post data
                    tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, e);

                    return NextSocketAction.CONTINUE;
                }
                else {
                    // Delay send
                    tur.error = e;
                    tur.req.setContentHandler(ReqContentHandlerUtil.devNull);
                    return NextSocketAction.CONTINUE;
                }
            }
        }
        return NextSocketAction.CONTINUE;
    }

    handleData(cmd: CmdData): number {
        BayLog.debug("%s handle_data: stm=%d len=%d", this.ship, cmd.streamId, cmd.length);
        let tur = this.getTour(cmd.streamId);
        if(tur == null) {
            throw new Error("Invalid stream id: " + cmd.streamId);
        }
        if(tur.req.headers.contentLength() <= 0) {
            throw new ProtocolException("Post content not allowed");
        }

        let success = true;
        if(cmd.length > 0) {
            success = tur.req.postContent(Tour.TOUR_ID_NOCHECK, cmd.data, cmd.start, cmd.length);
            if (tur.req.bytesPosted >= tur.req.headers.contentLength()) {

                if(tur.error != null){
                    // Error has occurred on header completed

                    tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, tur.error);
                    return NextSocketAction.CONTINUE;
                }
                else {
                    try {
                        this.endReqContent(tur.id(), tur);
                    } catch (e) {
                        tur.res.sendHttpException(Tour.TOUR_ID_NOCHECK, e);
                        return NextSocketAction.CONTINUE;
                    }
                }
            }
        }

        if(!success)
            return NextSocketAction.SUSPEND;
        else
            return NextSocketAction.CONTINUE;
    }

    handlePriority(cmd: CmdPriority): number {
        if(cmd.streamId == 0)
            throw new ProtocolException("Invalid streamId");
        return NextSocketAction.CONTINUE;
    }

    handleSettings(cmd: CmdSettings): number {
        let sip = this.inboundShip()
        BayLog.debug("%s handleSettings: stmid=%d", sip, cmd.streamId);
        if(cmd.flags.ack())
            return NextSocketAction.CONTINUE; // ignore ACK

        for(const item of cmd.items) {
            BayLog.debug("%s handle: Setting id=%d, value=%d", sip, item.id, item.value);
            switch(item.id) {
                case CmdSettings.HEADER_TABLE_SIZE:
                    this.settings.headerTableSize = item.value;
                    break;
                case CmdSettings.ENABLE_PUSH:
                    this.settings.enablePush = (item.value != 0);
                    break;
                case CmdSettings.MAX_CONCURRENT_STREAMS:
                    this.settings.maxConcurrentStreams = item.value;
                    break;
                case CmdSettings.INITIAL_WINDOW_SIZE:
                    this.settings.initialWindowSize = item.value;;
                    break;
                case CmdSettings.MAX_FRAME_SIZE:
                    this.settings.maxFrameSize = item.value;
                    break;
                case CmdSettings.MAX_HEADER_LIST_SIZE:
                    this.settings.maxHeaderListSize = item.value;
                    break;
                default:
                    BayLog.debug("Invalid settings id (Ignore): %d", item.id);
            }
        }

        let res = new CmdSettings(0, new H2Flags(H2Flags.FLAGS_ACK));
        this.commandPacker.post(sip, res);
        return NextSocketAction.CONTINUE;
    }

    handleWindowUpdate(cmd: CmdWindowUpdate): number {
        if(cmd.windowSizeIncrement == 0)
            throw new ProtocolException("Invalid increment value");
        BayLog.debug("%s handleWindowUpdate: stmid=%d siz=%d", this.ship,  cmd.streamId, cmd.windowSizeIncrement);
        let windowSizse = cmd.windowSizeIncrement;
        return NextSocketAction.CONTINUE;
    }

    handleGoAway(cmd: CmdGoAway): number {
        BayLog.debug("%s received GoAway: lastStm=%d code=%d desc=%s debug=%s",
            this.ship, cmd.lastStreamId, cmd.errorCode, H2ErrorCode.msg.get(cmd.errorCode.toString()), new String(cmd.debugData));
        return NextSocketAction.CLOSE;
    }

    handlePing(cmd: CmdPing): number {
        let sip = this.inboundShip();
        BayLog.debug("%s handle_ping: stm=%d", sip, cmd.streamId);

        let res = new CmdPing(cmd.streamId, new H2Flags(H2Flags.FLAGS_ACK), cmd.opaqueData);
        this.commandPacker.post(sip, res);
        return NextSocketAction.CONTINUE;
    }

    handleRstStream(cmd: CmdRstStream): number {
        BayLog.debug("%s received RstStream: stmid=%d code=%d desc=%s",
            this.ship, cmd.streamId, cmd.errorCode, H2ErrorCode.msg.get(cmd.errorCode.toString()));
        return NextSocketAction.CONTINUE;
    }



    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////

    getTour(key: number): Tour {
        return this.inboundShip().getTour(key)
    }

    endReqContent(chkId: number, tur: Tour): void {
        tur.req.endContent(chkId)
    }

    startTour(tur: Tour): void {
        let sip = this.inboundShip();

        HttpUtil.parseHostPort(tur, sip.portDocker.isSecure() ? 443 : 80);
        HttpUtil.parseAuthrization(tur);

        tur.req.protocol = this.httpProtocol;

        let skt: net.Socket = sip.ch.socket
        tur.req.remotePort = skt.remotePort;

        tur.req.remoteAddress = skt.remoteAddress;
        tur.req.serverAddress = skt.localAddress;
        tur.req.remoteHostFunc = () => HttpUtil.resolveHost(tur.req.remoteAddress);

        tur.req.serverPort = tur.req.reqPort;
        tur.req.serverName = tur.req.reqHost;
        tur.isSecure = sip.portDocker.isSecure();

        tur.go();
    }




}
