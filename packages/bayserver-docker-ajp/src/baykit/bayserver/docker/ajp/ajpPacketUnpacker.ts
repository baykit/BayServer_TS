import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {AjpPacket} from "./ajpPacket";
import {SimpleBuffer} from "bayserver-core/baykit/bayserver/util/simpleBuffer";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {AjpCommandUnPacker} from "./ajpCommandUnPacker";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {CharUtil} from "bayserver-core/baykit/bayserver/util/charUtil";
import {AjpType} from "./ajpType";

/**
 * AJP Protocol
 * https://tomcat.apache.org/connectors-doc/ajp/ajpv13a.html
 *
 */
export class AjpPacketUnpacker extends PacketUnpacker<AjpPacket> {

    preambleBuf: SimpleBuffer = new SimpleBuffer()
    bodyBuf: SimpleBuffer = new SimpleBuffer()

    static readonly STATE_READ_PREAMBLE = 1
    static readonly STATE_READ_BODY = 2
    static readonly STATE_END = 3

    state: number = AjpPacketUnpacker.STATE_READ_PREAMBLE

    readonly pktStore: PacketStore<AjpPacket>
    readonly cmdUnpacker: AjpCommandUnPacker
    bodyLen: number
    readBytes: number
    type: number
    toServer: boolean
    needData: boolean

    constructor(pktStore: PacketStore<AjpPacket>, cmdUnpacker: AjpCommandUnPacker) {
        super();
        this.pktStore = pktStore;
        this.cmdUnpacker = cmdUnpacker;
    }

    reset() {
        this.state = AjpPacketUnpacker.STATE_READ_PREAMBLE;
        this.bodyLen = 0;
        this.readBytes = 0;
        this.needData = false;
        this.preambleBuf.reset();
        this.bodyBuf.reset();
    }

    bytesReceived(buf: Buffer): number {
        let suspend = false;

        let pos = 0;
        let lineLen = 0;
        while (pos < buf.length) {
            if (this.state == AjpPacketUnpacker.STATE_READ_PREAMBLE) {
                let len = AjpPacket.PREAMBLE_SIZE - this.preambleBuf.len;
                if (buf.length - pos < len)
                    len = buf.length - pos;

                this.preambleBuf.put(buf, pos, len);
                pos += len

                if (this.preambleBuf.len == AjpPacket.PREAMBLE_SIZE) {
                    this.preambleRead();
                    this.changeState(AjpPacketUnpacker.STATE_READ_BODY);
                }
            }

            if (this.state == AjpPacketUnpacker.STATE_READ_BODY) {
                let len = this.bodyLen - this.bodyBuf.len;
                if (len > buf.length - pos) {
                    len = buf.length - pos;
                }

                this.bodyBuf.put(buf, pos, len);
                pos += len

                if (this.bodyBuf.len == this.bodyLen) {
                    this.bodyRead();
                    this.changeState(AjpPacketUnpacker.STATE_END);
                }
            }

            if (this.state == AjpPacketUnpacker.STATE_END) {
                //BayLog.trace("ajp: parse end: preamblelen=" + preambleBuf.length() + " bodyLen=" + bodyBuf.length() + " type=" + type);
                let pkt = this.pktStore.rent(this.type);
                pkt.toServer = this.toServer;
                pkt.newAjpHeaderAccessor().putBytes(this.preambleBuf.bytes(), 0, this.preambleBuf.len);
                pkt.newAjpDataAccessor().putBytes(this.bodyBuf.bytes(), 0, this.bodyBuf.len);
                let nextSocketAction = -1;
                try {
                    nextSocketAction = this.cmdUnpacker.packetReceived(pkt);
                }
                finally {
                    this.pktStore.Return(pkt);
                }
                this.reset();
                this.needData = this.cmdUnpacker.needData();

                if(nextSocketAction == NextSocketAction.SUSPEND) {
                    suspend = true;
                }
                else if(nextSocketAction != NextSocketAction.CONTINUE)
                    return nextSocketAction;
            }
        }

        BayLog.debug("ajp next read");
        if(suspend)
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

    private preambleRead() : void {
        let data = this.preambleBuf.bytes();

        if (data[0] == 0x12 && data[1] == 0x34)
            this.toServer = true;
        else if (data[0] == CharUtil.A_CODE && data[1] == CharUtil.B_CODE)
            this.toServer = false;
        else
            throw new ProtocolException("Must be start with 0x1234 or 'AB'");

        this.bodyLen = ((data[2] << 8) | (data[3] & 0xff)) & 0xffff;
        BayLog.trace("ajp: read packet preamble: bodyLen=" + this.bodyLen);
    }

    bodyRead() : void {
        if(this.needData)
            this.type = AjpType.DATA;
        else
            this.type = this.bodyBuf.bytes()[0] & 0xff
    }
}