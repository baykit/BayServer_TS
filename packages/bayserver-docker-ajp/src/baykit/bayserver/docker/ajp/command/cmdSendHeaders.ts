import {AjpCommand} from "../ajpCommand";
import {AjpAccessor, AjpPacket} from "../ajpPacket";
import {AjpType} from "../ajpType";
import {AjpCommandHandler} from "../ajpCommandHandler";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {ArrayUtil} from "bayserver-core/baykit/bayserver/util/arrayUtil";

/**
 * Send headers format
 *
 * AJP13_SEND_HEADERS :=
 *   prefix_code       4
 *   http_status_code  (integer)
 *   http_status_msg   (string)
 *   num_headers       (integer)
 *   response_headers *(res_header_name header_value)
 *
 * res_header_name :=
 *     sc_res_header_name | (string)   [see below for how this is parsed]
 *
 * sc_res_header_name := 0xA0 (byte)
 *
 * header_value := (string)
 */
export class CmdSendHeaders extends AjpCommand {

    static wellKnownHeaders: Map<string, number> = new Map<string, number>()

    static getWellKnownHeaderName(code: number) : string | null {
        for(const [name, value] of this.wellKnownHeaders) {
            if(value == code)
                return name;
        }
        return null;
    }

    readonly headers: Map<string, string[]> = new Map<string, string[]>()
    status : number
    desc : string

    constructor() {
        super(AjpType.SEND_HEADERS, false);
        this.status = HttpStatus.OK
        this.desc = null
    }

    pack(pkt: AjpPacket) : void {
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.putByte(this.type);
        acc.putShort(this.status);
        acc.putString(HttpStatus.description(this.status));

        let count = 0;
        for(const [name, values] of this.headers) {
            count += values.length;
        }

        acc.putShort(count);
        for(const [name, values] of this.headers) {
            let code = CmdSendHeaders.wellKnownHeaders.get(name.toLowerCase());
            for (let value of values) {
                if (code != null) {
                    acc.putShort(code);
                } else {
                    acc.putString(name);
                }
                acc.putString(value);
            }
        }

        // must be called from last line
        super.pack(pkt);
    }

    unpack(pkt: AjpPacket) : void {
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        let prefixCode = acc.getByte();
        if(prefixCode != AjpType.SEND_HEADERS)
            throw new ProtocolException("Expected SEND_HEADERS");

        this.setStatus(acc.getShort());
        this.setDesc(acc.getString());
        let count = acc.getShort();
        for(let i = 0; i < count; i++) {
            let code = acc.getShort();
            let name = CmdSendHeaders.getWellKnownHeaderName(code);
            if(name == null) {
                // code is length
                name = acc.getStringByLen(code);
            }
            let value = acc.getString();
            this.addHeader(name, value);
        }
    }

    handle(handler: AjpCommandHandler): number {
        return handler.handleSendHeaders(this);
    }

    setStatus(status: number): void {
        this.status = status;
    }

    setDesc(desc: string) : void {
        this.desc = desc
    }

    getHeader(name: string): string | null {
        let values = this.headers.get(name.toLowerCase());
        if(values == null || ArrayUtil.empty(values))
            return null;
        else
        return values[0];
    }

    addHeader(name: string, value: string) : void {
        let values = this.headers.get(name);
        if(values == null) {
            values = []
            this.headers.set(name, values);
        }
        values.push(value);
    }
}

CmdSendHeaders.wellKnownHeaders.set("content-type", 0xA001);
CmdSendHeaders.wellKnownHeaders.set("content-language", 0xA002);
CmdSendHeaders.wellKnownHeaders.set("content-length", 0xA003);
CmdSendHeaders.wellKnownHeaders.set("date", 0xA004);
CmdSendHeaders.wellKnownHeaders.set("last-modified", 0xA005);
CmdSendHeaders.wellKnownHeaders.set("location", 0xA006);
CmdSendHeaders.wellKnownHeaders.set("set-cookie", 0xA007);
CmdSendHeaders.wellKnownHeaders.set("set-cookie2", 0xA008);
CmdSendHeaders.wellKnownHeaders.set("servlet-engine", 0xA009);
CmdSendHeaders.wellKnownHeaders.set("status", 0xA00A);
CmdSendHeaders.wellKnownHeaders.set("www-authenticate", 0xA00B);