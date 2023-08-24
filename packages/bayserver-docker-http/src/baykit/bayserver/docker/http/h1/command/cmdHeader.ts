import {H1Command} from "../h1Command";
import {H1CommandHandler} from "../h1CommandHandler";
import {H1Packet} from "../h1Packet";
import {H1Type} from "../h1Type";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver"
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {PacketPartAccessor} from "bayserver-core/baykit/bayserver/protocol/packetPartAccessor";
import {HttpHeaders} from "bayserver-core/baykit/bayserver/util/httpHeaders";
import {CharUtil} from "bayserver-core/baykit/bayserver/util/charUtil";
import {IOException} from "bayserver-core/baykit/bayserver/util/ioException";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {BayMessage} from "bayserver-core/baykit/bayserver/bayMessage";
import {Symbol} from "bayserver-core/baykit/bayserver/symbol";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";

/**
 * Header format
 *
 *
 *        generic-message = start-line
 *                           *(message-header CRLF)
 *                           CRLF
 *                           [ message-body ]
 *        start-line      = Request-Line | Status-Line
 *
 *
 *        message-header = field-name ":" [ field-value ]
 *        field-name     = token
 *        field-value    = *( field-content | LWS )
 *        field-content  = <the OCTETs making up the field-value
 *                         and consisting of either *TEXT or combinations
 *                         of token, separators, and quoted-string>
 */
export class CmdHeader extends H1Command {

    static readonly STATE_READ_FIRST_LINE: number = 1;
    static readonly STATE_READ_MESSAGE_HEADERS: number = 2;

    headers: string[][] = []
    req: boolean; // request packet
    method: string
    uri: string
    version: string;
    status: number;

    constructor(req: boolean) {
        super(H1Type.HEADER);
        this.req = req;
    }

    static newReqHeader(method: string, uri: string, version: string): CmdHeader {
        let h: CmdHeader = new CmdHeader(true);
        h.method = method;
        h.uri = uri;
        h.version = version;
        return h;
    }

    static newResHeader(headers: HttpHeaders, version: string): CmdHeader {
        let h: CmdHeader = new CmdHeader(false);
        h.version = version;
        h.status = headers.status;
        for(const name of headers.names()) {
            for(const value of headers.values(name)) {
                h.add(name, value);
            }
        }
        return h;
    }


    add(name: string, value: string) {
        if(value == null) {
            BayLog.warn("Header value is null: " + name);
        }
        else {
            this.headers.push([name, value]);
        }
    }

    set(name: string, value: string) {
        if(value == null) {
            BayLog.warn("Header value is null: " + name);
            return;
        }

        for(const nv of this.headers) {
            if (StrUtil.eqIgnoreCase(nv[0], name)) {
                nv[1] = value;
                return;
            }
        }
        this.headers.push([name, value]);
    }


    handle(handler: H1CommandHandler): number {
        return handler.handleHeader(this)
    }

    pack(pkt: H1Packet): void {
        let acc = pkt.newDataAccessor();
        if(this.req) {
            this.packRequestLine(acc);
        }
        else {
            this.packStatusLine(acc);
        }
        for(const nv of this.headers) {
            this.packMessageHeader(acc, nv[0], nv[1]);
        }
        this.packEndHeader(acc);
    }

    unpack(pkt: H1Packet): void {
        let acc: PacketPartAccessor = pkt.newDataAccessor();
        let pos = 0, dataLen = pkt.dataLen();
        let state = CmdHeader.STATE_READ_FIRST_LINE;

        var lineStartPos = 0;
        var lineLen = 0;

        loop:
            for (pos = 0; pos < dataLen; pos++) {
                let b = acc.getByte();
                switch(b) {
                    case CharUtil.CR_CODE:
                        continue;

                    case CharUtil.LF_CODE:
                        if (lineLen == 0)
                            break loop;
                        if (state == CmdHeader.STATE_READ_FIRST_LINE) {
                            if (this.req) {
                                this.unpackRequestLine(pkt.buf, lineStartPos, lineLen);
                            }
                            else {
                                this.unpackStatusLine(pkt.buf, lineStartPos, lineLen);
                            }
                            state = CmdHeader.STATE_READ_MESSAGE_HEADERS;
                        }
                        else {
                            this.unpackMessageHeader(pkt.buf, lineStartPos, lineLen);
                        }
                        lineLen = 0;
                        lineStartPos = pos + 1;
                        break;

                    default:
                        lineLen++;
                }
            }

        if(state == CmdHeader.STATE_READ_FIRST_LINE) {
            throw new ProtocolException(
                BayMessage.get(
                    Symbol.HTP_INVALID_HEADER_FORMAT,
                    pkt.buf.toString("latin1", lineStartPos, lineStartPos + lineLen)))

        }
    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////

    private unpackRequestLine(buf: Buffer, start: number, len: number) {
        let line = buf.toString("latin1", start, start + len)

        let items = line.split(" ");
        if (items.length != 3)
            throw new ProtocolException(BayMessage.get(Symbol.HTP_INVALID_FIRST_LINE, line));

        this.method = items[0];
        this.uri = items[1];
        this.version = items[2];
    }

    private unpackStatusLine(buf: Buffer, start: number, len: number) {
        let line = buf.toString("latin1", start, start + len);
        let parts = line.split(" ");

        if(parts.length < 2)
            throw new IOException(
                BayMessage.get(Symbol.HTP_INVALID_FIRST_LINE, line));

        this.version = parts[0];
        let status = parts[1];

        try {
            this.status = Number.parseInt(status);
        }
        catch (e) {
            throw new IOException(
                BayMessage.get(Symbol.HTP_INVALID_FIRST_LINE, line));
        }
    }

    private unpackMessageHeader(bytes: Buffer, start: number, len: number) {
        let buf = Buffer.alloc(len)
        let readName = true;
        let pos = 0;
        let skipping = true;
        var name: string = null
        var value: string = null

        for(let i = 0; i < len; i++) {
            let b: number = bytes[start + i];
            if(skipping && b == CharUtil.SP_CODE)
                continue;
            else if(readName && (b == CharUtil.CLN_CODE)) {
                name = buf.toString("latin1", 0, pos);
                pos = 0;
                skipping = true;
                readName = false;
            }
            else {
                if(readName) {
                    // make the case of header name be lower force
                    buf[pos++] = CharUtil.toLowerCase(b);
                }
                else {
                    buf[pos++] = b;
                }
                skipping = false;
            }
        }

        if (name == null) {
            throw new ProtocolException(
                BayMessage.get(
                    Symbol.HTP_INVALID_HEADER_FORMAT,
                    buf.toString("latin1", start, start + length)))
        }

        value = buf.toString("latin1", 0, pos);

        //if(BayServer.harbor.isTraceHeader())
        //    BayLog.info("H1 header: %s=%s", name, value)
        this.add(name, value);
    }


    private packRequestLine(acc: PacketPartAccessor) {
        acc.putString(this.method);
        acc.putString(" ");
        acc.putString(this.uri);
        acc.putString(" ");
        acc.putString(this.version);
        acc.putString("\r\n");
    }


    private packStatusLine(acc: PacketPartAccessor) {
        let desc = HttpStatus.description(this.status);

        if (this.version != null && this.version == "HTTP/1.1")
            acc.putString("HTTP/1.1");
        else
            acc.putString("HTTP/1.0");

        // status
        acc.putString(H1Packet.SP_BYTES);
        acc.putString(this.status.toString());
        acc.putString(H1Packet.SP_BYTES);
        acc.putString(desc);
        acc.putString("\r\n");
    }


    private packMessageHeader(acc: PacketPartAccessor, name: string, value: string) {
        acc.putString(name);
        acc.putString(":");
        acc.putString(value);
        acc.putString("\r\n");
    }

    private packEndHeader(acc: PacketPartAccessor) {
        acc.putString("\r\n");
    }
}