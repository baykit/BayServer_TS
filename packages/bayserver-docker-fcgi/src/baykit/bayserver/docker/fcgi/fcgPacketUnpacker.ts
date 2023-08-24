import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {FcgPacket} from "./fcgPacket";
import {SimpleBuffer} from "bayserver-core/baykit/bayserver/util/simpleBuffer";
import {FcgCommandUnPacker} from "./fcgCommandUnPacker";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {Sink} from "bayserver-core/baykit/bayserver/sink";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";

/**
 * AJP Protocol
 * https://tomcat.apache.org/connectors-doc/ajp/ajpv13a.html
 *
 */
export class FcgPacketUnpacker extends PacketUnpacker<FcgPacket> {

    headerBuf: SimpleBuffer = new SimpleBuffer()
    dataBuf: SimpleBuffer = new SimpleBuffer()

    static readonly STATE_READ_PREAMBLE: number = 1  // #state for reading first 8 bytes (from version to reserved)
    static readonly STATE_READ_CONTENT: number = 2  // state for reading content data
    static readonly STATE_READ_PADDING: number = 3  // state for reading padding data
    static readonly STATE_END: number = 4  // End

    version: number
    type: number
    reqId: number
    length: number
    padding: number
    paddingReadBytes: number

    state: number

    cmdUnpacker: FcgCommandUnPacker
    pktStore: PacketStore<FcgPacket>

    contLen: number
    readBytes: number

    constructor(pktStore: PacketStore<FcgPacket>, cmdUnpacker: FcgCommandUnPacker) {
        super();
        this.pktStore = pktStore;
        this.cmdUnpacker = cmdUnpacker;
        this.reset()
    }

    reset() {
        this.state = FcgPacketUnpacker.STATE_READ_PREAMBLE;
        this.version = 0;
        this.type = null;
        this.reqId = 0;
        this.length = 0;
        this.padding = 0;
        this.paddingReadBytes = 0;
        this.contLen = 0;
        this.readBytes = 0;
        this.headerBuf.reset();
        this.dataBuf.reset();
    }

    bytesReceived(buf: Buffer): number {
        let nextSuspend = false;
        let nextWrite = false

        let pos = 0;
        let lineLen = 0;
        while (pos < buf.length) {
            while (this.state != FcgPacketUnpacker.STATE_END && pos < buf.length) {
                switch (this.state) {
                    case FcgPacketUnpacker.STATE_READ_PREAMBLE: {
                        // preamble read mode
                        let len = FcgPacket.PREAMBLE_SIZE - this.headerBuf.len;
                        if (buf.length - pos < len)
                            len = buf.length - pos;

                        this.headerBuf.put(buf, pos, len);
                        pos += len

                        if (this.headerBuf.len == FcgPacket.PREAMBLE_SIZE) {
                            this.headerReadDone();
                            if (this.length == 0) {
                                if (this.padding == 0)
                                    this.changeState(FcgPacketUnpacker.STATE_END);
                                else
                                    this.changeState(FcgPacketUnpacker.STATE_READ_PADDING);
                            } else {
                                this.changeState(FcgPacketUnpacker.STATE_READ_CONTENT);
                            }
                        }
                        break;
                    }
                    case FcgPacketUnpacker.STATE_READ_CONTENT: {
                        // content read mode
                        let len = this.length - this.dataBuf.len;
                        if (len > buf.length - pos) {
                            len = buf.length - pos;
                        }
                        if (len > 0) {
                            this.dataBuf.put(buf, pos, len);
                            pos += len

                            if (this.dataBuf.len == this.length) {
                                if (this.paddingReadBytes == 0)
                                    this.changeState(FcgPacketUnpacker.STATE_END);
                                else
                                    this.changeState(FcgPacketUnpacker.STATE_READ_PADDING);
                            }
                        }
                        break;
                    }
                    case FcgPacketUnpacker.STATE_READ_PADDING: {
                        // padding read mode
                        let len = this.padding - this.paddingReadBytes;
                        if (len > buf.length - pos) {
                            len = buf.length - pos;
                        }

                        pos += len // skip data

                        if (len > 0) {
                            this.paddingReadBytes += len;
                            if (this.paddingReadBytes == this.padding) {
                                this.changeState(FcgPacketUnpacker.STATE_END);
                            }
                        }
                        break;
                    }
                    default:
                        throw new Error("IllegalState");
                }
            }


            if (this.state == FcgPacketUnpacker.STATE_END) {
                let pkt = this.pktStore.rent(this.type);
                pkt.reqId = this.reqId;
                pkt.newHeaderAccessor().putBytes(this.headerBuf.bytes(), 0, this.headerBuf.len);
                pkt.newDataAccessor().putBytes(this.dataBuf.bytes(), 0, this.dataBuf.len);
                let state;
                try {
                    state = this.cmdUnpacker.packetReceived(pkt);
                }
                finally {
                    this.pktStore.Return(pkt);
                }
                this.reset();

                switch (state) {
                    case NextSocketAction.SUSPEND:
                        nextSuspend = true;
                        break;

                    case NextSocketAction.CONTINUE:
                        break;

                    case NextSocketAction.WRITE:
                        nextWrite = true;
                        break;

                    case NextSocketAction.CLOSE:
                        return state;

                    default:
                        throw new Sink();
                }
            }
        }

        if(nextWrite)
            return NextSocketAction.WRITE
        else if(nextSuspend)
            return NextSocketAction.SUSPEND;
        else
            return NextSocketAction.CONTINUE;
    }


    ///////////////////////////////////////////////////////////
    // private methods
    ///////////////////////////////////////////////////////////

    private changeState(newState: number) : void {
        this.state = newState;
    }

    private headerReadDone() : void {
        let pre = this.headerBuf.bytes();
        this.version = this.byteToInt(pre[0]);
        this.type = this.byteToInt(pre[1]);
        this.reqId = this.bytesToInt(pre[2], pre[3]);
        this.length = this.bytesToInt(pre[4], pre[5]);
        this.padding = this.byteToInt(pre[6]);
        let reserved = this.byteToInt(pre[7]);
        BayLog.debug("fcg Read packet header: version=%s type=%s reqId=%d length=%d padding=%d",
            this.version, this.type, this.reqId, this.length, this.padding);
    }

    private byteToInt(b: number): number {
        return b & 0xff;
    }

    private bytesToInt(b1: number, b2: number): number {
        return this.byteToInt(b1) << 8 | this.byteToInt(b2);
    }
}