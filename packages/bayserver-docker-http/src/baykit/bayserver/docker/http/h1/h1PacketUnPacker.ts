import {PacketUnpacker} from "bayserver-core/baykit/bayserver/protocol/packetUnpacker";
import {H1Packet} from "./h1Packet";
import {H1CommandUnPacker} from "./h1CommandUnPacker";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {H1Type} from "./h1Type";
import {SimpleBuffer} from "bayserver-core/baykit/bayserver/util/simpleBuffer";
import {CharUtil} from "bayserver-core/baykit/bayserver/util/charUtil";
import {NextSocketAction} from "bayserver-core/baykit/bayserver/agent/nextSocketAction";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";

/**
 * Read HTTP header
 *
 *   HTTP/1.x has no packet format. So we make HTTP header and content pretend to be packet
 *
 *   From RFC2616
 *   generic-message : start-line
 *                     (message-header CRLF)*
 *                     CRLF
 *                     [message-body]
 *
 *
 */
export class H1PacketUnpacker extends PacketUnpacker<H1Packet> {

    static readonly STATE_READ_HEADERS: number = 1;
    static readonly STATE_READ_CONTENT: number = 2;
    static readonly STATE_END: number = 3;

    static readonly MAX_LINE_LEN: number = 8192;

    state: number = H1PacketUnpacker.STATE_READ_HEADERS
    cmdUnpacker: H1CommandUnPacker;
    pktStore: PacketStore<H1Packet>;
    tmpBuf: SimpleBuffer;

    constructor(cmdUnpacker: H1CommandUnPacker, pktStore: PacketStore<H1Packet>) {
        super()
        this.cmdUnpacker = cmdUnpacker;
        this.pktStore = pktStore;
        this.tmpBuf = new SimpleBuffer();
    }

    //////////////////////////////////////////////////////
    // implements Reusable
    //////////////////////////////////////////////////////

    reset(): void {
        this.resetState()
    }


    //////////////////////////////////////////////////////
    // implements PacketUnpacker
    //////////////////////////////////////////////////////
    bytesReceived(buf): number {
        if(this.state == H1PacketUnpacker.STATE_END) {
            this.reset();
            throw new Error("Illegal State");
        }

        BayLog.trace("%s bytes received: ofs=%d len=%d tmp=%d", this.cmdUnpacker.handler, buf.byteOffset, buf.length, this.tmpBuf.len);
        let suspend = false;
        let pos = 0;
        let lineLen = 0;
        if(this.state == H1PacketUnpacker.STATE_READ_HEADERS) {
            loop:
                while (pos < buf.length) {
                    let b: number = buf[pos];
                    this.tmpBuf.putByte(b);
                    pos++;
                    if (b == CharUtil.CR_CODE)
                        continue;
                    else if (b == CharUtil.LF_CODE) {
                        if(lineLen == 0) {
                            let pkt = this.pktStore.rent(H1Type.HEADER);
                            pkt.newDataAccessor().putBytes(this.tmpBuf.bytes(), 0, this.tmpBuf.len);
                            var nextAct
                            try {
                                nextAct = this.cmdUnpacker.packetReceived(pkt);
                            }
                            finally {
                                this.pktStore.Return(pkt);
                            }

                            switch(nextAct) {
                                case NextSocketAction.SUSPEND:
                                    suspend = true; // not break
                                case NextSocketAction.CONTINUE:
                                    if(this.cmdUnpacker.reqFinished())
                                        this.changeState(H1PacketUnpacker.STATE_END);
                                    else
                                        this.changeState(H1PacketUnpacker.STATE_READ_CONTENT);
                                    break loop
                                case NextSocketAction.CLOSE:
                                    // Maybe error
                                    this.resetState();
                                    return nextAct;
                            }
                        }
                        lineLen = 0;
                    }
                    else {
                        lineLen++;
                    }

                    if(lineLen >= H1PacketUnpacker.MAX_LINE_LEN) {
                        throw new ProtocolException("Http/1 Line is too long");
                    }
                }
        }

        if(this.state == H1PacketUnpacker.STATE_READ_CONTENT) {
            while(pos < buf.length) {
                let pkt = this.pktStore.rent(H1Type.CONTENT);
                let len = buf.length - pos;
                if(len > H1Packet.MAX_DATA_LEN)
                    len = H1Packet.MAX_DATA_LEN;

                pkt.newDataAccessor().putBytes(buf, pos, len);
                pos += len;

                try {
                    nextAct = this.cmdUnpacker.packetReceived(pkt);
                }
                finally {
                    this.pktStore.Return(pkt);
                }

                switch(nextAct) {
                    case NextSocketAction.CONTINUE:
                    case NextSocketAction.WRITE:
                        if(this.cmdUnpacker.reqFinished())
                            this.changeState(H1PacketUnpacker.STATE_END);
                        break;
                    case NextSocketAction.SUSPEND:
                        suspend = true;
                        break;
                    case NextSocketAction.CLOSE:
                        this.resetState();
                        return nextAct;
                }
            }
        }

        if(this.state == H1PacketUnpacker.STATE_END)
            this.resetState();

        if(suspend) {
            BayLog.debug("H1 read suspend");
            return NextSocketAction.SUSPEND;
        }
        else
            return NextSocketAction.CONTINUE;

    }


    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////


    private changeState(newState: number): void {
        this.state = newState;
    }

    private resetState(): void {
        this.changeState(H1PacketUnpacker.STATE_READ_HEADERS);
        this.tmpBuf = new SimpleBuffer()
    }

    private isAscii(c: number): boolean {
        return c >= 32 && c <= 126;
    }
}