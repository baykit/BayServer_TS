import {AjpCommand} from "../ajpCommand";
import {AjpAccessor, AjpPacket} from "../ajpPacket";
import {AjpType} from "../ajpType";
import {AjpCommandHandler} from "../ajpCommandHandler";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {HttpHeaders} from "bayserver-core/baykit/bayserver/util/httpHeaders";

/**
 * AJP protocol
 *    https://tomcat.apache.org/connectors-doc/ajp/ajpv13a.html
 *
 * AJP13_FORWARD_REQUEST :=
 *     prefix_code      (byte) 0x02 = JK_AJP13_FORWARD_REQUEST
 *     method           (byte)
 *     protocol         (string)
 *     req_uri          (string)
 *     remote_addr      (string)
 *     remote_host      (string)
 *     server_name      (string)
 *     server_port      (integer)
 *     is_ssl           (boolean)
 *     num_headers      (integer)
 *     request_headers *(req_header_name req_header_value)
 *     attributes      *(attribut_name attribute_value)
 *     request_terminator (byte) OxFF
 */
export class CmdForwardRequest extends AjpCommand {

    static methods: Map<number, string> = new Map<number, string>()

    static getMethodCode(method: string): number {
        for(const [code, codeMethod] of this.methods) {
            if(StrUtil.eqIgnoreCase(codeMethod, method))
                return code;
        }
        return -1;
    }

    static wellKnownHeaders: Map<number, string> = new Map<number, string>()

    static getWellKnownHeaderCode(name: string): number {
        for(const [code, codeName] of this.wellKnownHeaders) {
            if(StrUtil.eqIgnoreCase(codeName, name))
                return code;
        }
        return -1;
    }

    static attributeNames:  Map<number, string> = new Map<number, string>()

    static getAttributeCode(atr: string): number {
        for(const [code, codeAtr] of this.attributeNames) {
            if(StrUtil.eqIgnoreCase(codeAtr, atr))
                return code;
        }
        return -1;
    }

    method: string
    protocol: string
    reqUri: string
    remoteAddr: string
    remoteHost: string
    serverName: string
    serverPort: number
    isSsl: boolean
    headers: HttpHeaders = new HttpHeaders()
    readonly attributes: Map<string, string> = new Map<string, string>();

    constructor() {
        super(AjpType.FORWARD_REQUEST, true)
    }

    toString(): string {
        let s: string = "ForwardRequest(m=" + this.method + " p=" + this.protocol + " u=" + this.reqUri +
            " ra=" + this.remoteAddr + " rh=" + this.remoteHost + " sn=" + this.serverName;
        s += " sp=" +this.serverPort + " ss=" + this.isSsl + " h=" + this.headers;
        return s;
    }

    pack(pkt: AjpPacket) : void {
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.putByte(this.type); // prefix code
        acc.putByte(CmdForwardRequest.getMethodCode(this.method));
        acc.putString(this.protocol);
        acc.putString(this.reqUri);
        acc.putString(this.remoteAddr);
        acc.putString(this.remoteHost);
        acc.putString(this.serverName);
        acc.putShort(this.serverPort);
        acc.putByte(this.isSsl ? 1 : 0);
        this.writeRequestHeaders(acc);
        this.writeAttributes(acc);

        // must be called from last line
        super.pack(pkt);
    }

    unpack(pkt: AjpPacket) : void {
        super.unpack(pkt);
        let acc: AjpAccessor = pkt.newAjpDataAccessor();
        acc.getByte(); // prefix code
        this.method = CmdForwardRequest.methods.get(acc.getByte());
        this.protocol = acc.getString();
        this.reqUri = acc.getString();
        this.remoteAddr = acc.getString();
        this.remoteHost = acc.getString();
        this.serverName = acc.getString();
        this.serverPort = acc.getShort();
        this.isSsl = acc.getByte() == 1;
        //BayLog.debug("ForwardRequest: uri=" + reqUri);

        this.readRequestHeaders(acc);
        this.readAttributes(acc);
    }



    handle(handler: AjpCommandHandler): number {
        return handler.handleForwardRequest(this);
    }

    private readRequestHeaders(acc: AjpAccessor): void {
        let count = acc.getShort();
        for (let i = 0; i < count; i++) {
            let code = acc.getShort();
            let name = "";
            if (code >= 0xA000) {
                name = CmdForwardRequest.wellKnownHeaders.get(code);
            if (name == null)
                throw new ProtocolException("Invalid header");
            }
            else {
                name = acc.getStringByLen(code);
            }

            let value = acc.getString();
            this.headers.add(name, value);
        }
    }

    private readAttributes(acc: AjpAccessor) : void {
        while (true) {
            let code = acc.getByte();
            let name = "";
            if (code == 0xFF) {
                break;
            }
            else if (code == 0x0A) {
                name = acc.getString();
            }
            else {
                name = CmdForwardRequest.attributeNames.get(code);
                if (name == null)
                    throw new ProtocolException("Invalid attribute: code=" + code);
            }

            if (code == 0x0B) { // "?ssl_key_size"
                let value = acc.getShort();
                this.attributes.set(name, value.toString());
            }
            else {
                let value = acc.getString();
                this.attributes.set(name, value);
            }
        }
    }

    private writeRequestHeaders(acc: AjpAccessor) : void {
        let hlist: string[][] = [];
        for(const name of this.headers.names()) {
            for(const value of this.headers.values(name)) {
               hlist.push([name, value]);
            }
        }
        acc.putShort(hlist.length);
        for (const hdr of hlist) {
            let code = CmdForwardRequest.getWellKnownHeaderCode(hdr[0]);
            if(code != -1) {
                acc.putShort(code);
            }
            else {
                acc.putString(hdr[0]);
            }
            acc.putString(hdr[1]);
        }
    }

    private writeAttributes(acc: AjpAccessor) : void {
       for(const [name, value] of this.attributes) {
            let code = CmdForwardRequest.getAttributeCode(name);
            if(code != -1) {
                acc.putByte(code);
            }
            else {
                acc.putString(name);
            }
            acc.putString(value);
        }
        acc.putByte(0xFF); // terminator code
    }
}

CmdForwardRequest.methods.set(1, "OPTIONS")
CmdForwardRequest.methods.set(2, "GET")
CmdForwardRequest.methods.set(3, "HEAD")
CmdForwardRequest.methods.set(4, "POST")
CmdForwardRequest.methods.set(5, "PUT")
CmdForwardRequest.methods.set(6, "DELETE")
CmdForwardRequest.methods.set(7, "TRACE")
CmdForwardRequest.methods.set(8, "PROPFIND")
CmdForwardRequest.methods.set(9, "PROPPATCH")
CmdForwardRequest.methods.set(10, "MKCOL")
CmdForwardRequest.methods.set(11, "COPY")
CmdForwardRequest.methods.set(12, "MOVE")
CmdForwardRequest.methods.set(13, "LOCK")
CmdForwardRequest.methods.set(14, "UNLOCK")
CmdForwardRequest.methods.set(15, "ACL")
CmdForwardRequest.methods.set(16, "REPORT")
CmdForwardRequest.methods.set(17, "VERSION_CONTROL")
CmdForwardRequest.methods.set(18, "CHECKIN")
CmdForwardRequest.methods.set(19, "CHECKOUT")
CmdForwardRequest.methods.set(20, "UNCHECKOUT")
CmdForwardRequest.methods.set(21, "SEARCH")
CmdForwardRequest.methods.set(22, "MKWORKSPACE")
CmdForwardRequest.methods.set(23, "UPDATE")
CmdForwardRequest.methods.set(24, "LABEL")
CmdForwardRequest.methods.set(25, "MERGE")
CmdForwardRequest.methods.set(26, "BASELINE_CONTROL")
CmdForwardRequest.methods.set(27, "MKACTIVITY")

CmdForwardRequest.wellKnownHeaders.set(0xA001, "Accept");
CmdForwardRequest.wellKnownHeaders.set(0xA002, "Accept-Charset");
CmdForwardRequest.wellKnownHeaders.set(0xA003, "Accept-Encoding");
CmdForwardRequest.wellKnownHeaders.set(0xA004, "Accept-Language");
CmdForwardRequest.wellKnownHeaders.set(0xA005, "Authorization");
CmdForwardRequest.wellKnownHeaders.set(0xA006, "Connection");
CmdForwardRequest.wellKnownHeaders.set(0xA007, "Content-Type");
CmdForwardRequest.wellKnownHeaders.set(0xA008, "Content-Length");
CmdForwardRequest.wellKnownHeaders.set(0xA009, "Cookie");
CmdForwardRequest.wellKnownHeaders.set(0xA00A, "Cookie2");
CmdForwardRequest.wellKnownHeaders.set(0xA00B, "Host");
CmdForwardRequest.wellKnownHeaders.set(0xA00C, "Pragma");
CmdForwardRequest.wellKnownHeaders.set(0xA00D, "Referer");
CmdForwardRequest.wellKnownHeaders.set(0xA00E, "User-Agent");

CmdForwardRequest.attributeNames.set(0x01, "?context");
CmdForwardRequest.attributeNames.set(0x02, "?servlet_path");
CmdForwardRequest.attributeNames.set(0x03, "?remote_user");
CmdForwardRequest.attributeNames.set(0x04, "?auth_type");
CmdForwardRequest.attributeNames.set(0x05, "?query_string");
CmdForwardRequest.attributeNames.set(0x06, "?route");
CmdForwardRequest.attributeNames.set(0x07, "?ssl_cert");
CmdForwardRequest.attributeNames.set(0x08, "?ssl_cipher");
CmdForwardRequest.attributeNames.set(0x09, "?ssl_session");
CmdForwardRequest.attributeNames.set(0x0A, "?req_attribute");
CmdForwardRequest.attributeNames.set(0x0B, "?ssl_key_size");
CmdForwardRequest.attributeNames.set(0x0C, "?secret");
CmdForwardRequest.attributeNames.set(0x0D, "?stored_method");