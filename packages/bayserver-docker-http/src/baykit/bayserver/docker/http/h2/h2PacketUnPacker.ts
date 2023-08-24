import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {H2Packet} from "./h2Packet";
import {SimpleBuffer} from "bayserver-core/baykit/bayserver/util/simpleBuffer";
import {H2Type} from "./h2Type";
import {H2CommandUnPacker} from "./h2CommandUnPacker";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {H2Flags} from "./h2Flags";

/* refers tmpBuf */
class FrameHeaderItem {
    start: number
    len: number
    pos: number

    constructor(start: number, len: number) {
        this.start = start
        this.len = len
        this.pos = 0
    }

    get(buf: SimpleBuffer, index: number): number {
        return buf.bytes()[this.start + index] & 0xFF;
    }
}

export class H2PacketUnPacker extends PacketUnpacker<H2Packet> {

    static readonly STATE_READ_LENGTH: number = 1
    static readonly STATE_READ_TYPE: number = 2
    static readonly STATE_READ_FLAGS: number = 3
    static readonly STATE_READ_STREAM_IDENTIFIER: number = 4
    static readonly STATE_READ_FLAME_PAYLOAD: number = 5
    static readonly STATE_END: number = 6

    static readonly FRAME_LEN_LENGTH: number = 3
    static readonly FRAME_LEN_TYPE: number = 1
    static readonly FRAME_LEN_FLAGS: number = 1
    static readonly FRAME_LEN_STREAM_IDENTIFIER: number = 4

    static readonly FLAGS_END_STREAM: number = 0x1
    static readonly FLAGS_END_HEADERS: number = 0x4
    static readonly FLAGS_PADDED: number = 0x8
    static readonly FLAGS_PRIORITY: number = 0x20

    static CONNECTION_PREFACE = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n")

    state: number = H2PacketUnPacker.STATE_READ_LENGTH
    tmpBuf: SimpleBuffer = new SimpleBuffer();
    item: FrameHeaderItem = null;
    prefaceRead: boolean= false;
    type = 0;
    payloadLen = 0;
    flags = 0;
    streamId = 0;
    pos = 0

    readonly cmdUnpacker: H2CommandUnPacker;
    readonly pktStore: PacketStore<H2Packet> ;
    readonly serverMode: boolean = false;

    contLen: number;
    readBytes: number;

    constructor(cmdUnpacker: H2CommandUnPacker, pktStore: PacketStore<H2Packet>, serverMode: boolean) {
        super();
        this.cmdUnpacker = cmdUnpacker;
        this.pktStore = pktStore;
        this.serverMode = serverMode;
        this.reset();
    }

    reset(): void {
        this.resetState();
        this.prefaceRead = false;
    }

    resetState(): void {
        this.changeState(H2PacketUnPacker.STATE_READ_LENGTH);
        this.item = new FrameHeaderItem(0, H2PacketUnPacker.FRAME_LEN_LENGTH);
        this.contLen = 0;
        this.readBytes = 0;
        this.tmpBuf.reset();
        this.type = null;
        this.flags = 0;
        this.streamId = 0;
        this.payloadLen = 0;
    }


    bytesReceived(buf: Buffer): number {
        let suspend: boolean = false;

        this.pos = 0
        if(this.serverMode && !this.prefaceRead) {
            let len = H2PacketUnPacker.CONNECTION_PREFACE.length - this.tmpBuf.len;
            if(len > buf.length)
                len = buf.length

            this.tmpBuf.put(buf, this.pos, len);
            this.pos += len
            if(this.tmpBuf.len == H2PacketUnPacker.CONNECTION_PREFACE.length) {
                for(let i = 0; i < this.tmpBuf.len; i++) {
                    if(H2PacketUnPacker.CONNECTION_PREFACE[i] != this.tmpBuf.bytes()[i])
                        throw new ProtocolException("Invalid connection preface: " + this.tmpBuf.bytes().toString());
                }
                let pkt = this.pktStore.rent(H2Type.PREFACE);
                pkt.newDataAccessor().putBytes(this.tmpBuf.bytes(), 0, this.tmpBuf.len);
                let nstat = this.cmdUnpacker.packetReceived(pkt);
                this.pktStore.Return(pkt);
                if(nstat != NextSocketAction.CONTINUE)
                    return nstat;

                BayLog.debug("Connection preface OK");
                this.prefaceRead = true;
                this.tmpBuf.reset();
            }
        }

        while (this.state != H2PacketUnPacker.STATE_END && this.pos < buf.length) {
            switch (this.state) {
                case H2PacketUnPacker.STATE_READ_LENGTH:
                    if(this.readHeaderItem(buf)) {
                        this.payloadLen = (
                            (this.item.get(this.tmpBuf, 0) & 0xFF) << 16 |
                            (this.item.get(this.tmpBuf, 1) & 0xFF) << 8 |
                            (this.item.get(this.tmpBuf, 2) & 0xFF));
                        this.item = new FrameHeaderItem(this.tmpBuf.len, H2PacketUnPacker.FRAME_LEN_TYPE);
                        this.changeState(H2PacketUnPacker.STATE_READ_TYPE);
                    }
                    break;

                case H2PacketUnPacker.STATE_READ_TYPE:
                    if(this.readHeaderItem(buf)) {
                        this.type = this.item.get(this.tmpBuf, 0)
                        this.item = new FrameHeaderItem(this.tmpBuf.len, H2PacketUnPacker.FRAME_LEN_FLAGS);
                        this.changeState(H2PacketUnPacker.STATE_READ_FLAGS);
                    }
                    break;

                case H2PacketUnPacker.STATE_READ_FLAGS:
                    if(this.readHeaderItem(buf)) {
                        this.flags = this.item.get(this.tmpBuf, 0);
                        this.item = new FrameHeaderItem(this.tmpBuf.len, H2PacketUnPacker.FRAME_LEN_STREAM_IDENTIFIER);
                        this.changeState(H2PacketUnPacker.STATE_READ_STREAM_IDENTIFIER);
                    }
                    break;

                case H2PacketUnPacker.STATE_READ_STREAM_IDENTIFIER:
                    if(this.readHeaderItem(buf)) {
                        this.streamId = ((this.item.get(this.tmpBuf, 0) & 0x7F) << 24) |
                            (this.item.get(this.tmpBuf, 1) << 16) |
                            (this.item.get(this.tmpBuf, 2) << 8) |
                            this.item.get(this.tmpBuf, 3);
                        this.item = new FrameHeaderItem(this.tmpBuf.len, this.payloadLen);
                        this.changeState(H2PacketUnPacker.STATE_READ_FLAME_PAYLOAD);
                    }
                    break;

                case H2PacketUnPacker.STATE_READ_FLAME_PAYLOAD:
                    if(this.readHeaderItem(buf)) {
                        this.changeState(H2PacketUnPacker.STATE_END);
                    }
                    break;

                default:
                    throw new Error("Illegal State");
            }


            if (this.state == H2PacketUnPacker.STATE_END) {
                let pkt = this.pktStore.rent(this.type);
                pkt.streamId = this.streamId;
                pkt.flags = new H2Flags(this.flags);
                pkt.newHeaderAccessor().putBytes(this.tmpBuf.bytes(), 0, H2Packet.FRAME_HEADER_LEN);
                pkt.newDataAccessor().putBytes(this.tmpBuf.bytes(), H2Packet.FRAME_HEADER_LEN, this.tmpBuf.len - H2Packet.FRAME_HEADER_LEN);
                let nxtAct: number;
                try {
                    nxtAct = this.cmdUnpacker.packetReceived(pkt);
                    //BayServer.debug("H2 NextAction=" + nxtAct + " sz=" + tmpBuf.length() + " remain=" + buf.hasRemaining());
                }
                finally {
                    this.pktStore.Return(pkt);
                    this.resetState();
                }
                if(nxtAct == NextSocketAction.SUSPEND) {
                    suspend = true;
                }
                else if(nxtAct != NextSocketAction.CONTINUE)
                    return nxtAct;
            }
        }

        if(suspend)
            return NextSocketAction.SUSPEND;
        else
            return NextSocketAction.CONTINUE;

    }


    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////

    private readHeaderItem(buf: Buffer): boolean {
        let len = this.item.len - this.item.pos;
        if(buf.length - this.pos < len)
            len = buf.length - this.pos
        this.tmpBuf.put(buf, this.pos, len);
        this.pos += len
        this.item.pos += len;

        return this.item.pos == this.item.len;
    }

    private changeState(newState: number) {
        this.state = newState
    }
}