import {Tour} from "../tour/tour";
import {HttpHeaders} from "./httpHeaders";
import {StrUtil} from "./strUtil";
import {BayLog} from "../bayLog";
import {SimpleBuffer} from "./simpleBuffer";
import {CharUtil} from "./charUtil";
import {ProtocolException} from "../protocol/protocolException";

export class HttpUtil {
    static readonly MAX_LINE_LEN: number = 5000;

    /**
     * Send MIME headers This method is called from sendHeaders()
     */
    static sendMimeHeaders(hdr: HttpHeaders, out: SimpleBuffer) : void {

        // headers
        for (const name of hdr.names()) {
            for(const value of hdr.values(name)) {
                out.put(StrUtil.toBytes(name));
                out.putByte(HttpHeaders.HEADER_SEPARATOR_BYTES);
                out.put(StrUtil.toBytes(value));
                HttpUtil.sendNewLine(out)
            }
        }
    }

    static sendNewLine(buf: SimpleBuffer) : void {
        buf.put(CharUtil.CRLF_BYTES)
    }

    /**
     * Parse AUTHORIZATION header
     */
    static parseAuthrization(tur: Tour) {
        let auth = tur.req.headers.get(HttpHeaders.AUTHORIZATION);
        if (!StrUtil.empty(auth)) {
            let mch = auth.match(/Basic (.*)/);
            if (!mch) {
                BayLog.debug("Not matched with basic authentication format");
            }
            else {
                auth = mch[1];
                try {
                    auth = atob(auth);
                    mch = auth.match(/(.*):(.*)/);
                    if(mch) {
                        tur.req.remoteUser = mch[1];
                        tur.req.remotePass = mch[2];
                    }
                } catch (e) {
                    BayLog.error_e(e);
                }
            }
        }
    }

    static parseHostPort(tour: Tour, defaultPort: number) {
        tour.req.reqHost = "";

        let hostPort = tour.req.headers.get(HttpHeaders.X_FORWARDED_HOST);
        if(StrUtil.isSet(hostPort)) {
            tour.req.headers.remove(HttpHeaders.X_FORWARDED_HOST);
            tour.req.headers.set(HttpHeaders.HOST, hostPort);
        }

        hostPort = tour.req.headers.get(HttpHeaders.HOST);
        if(StrUtil.isSet(hostPort)) {
            let pos = hostPort.lastIndexOf(':');
            if(pos == -1) {
                tour.req.reqHost = hostPort;
                tour.req.reqPort = defaultPort;
            }
            else {
                tour.req.reqHost = hostPort.substring(0, pos);
                try {
                    tour.req.reqPort = Number.parseInt(hostPort.substring(pos + 1));
                }
                catch(e) {
                   BayLog.error_e(e);
                }
            }
        }
    }

    static resolveHost(adr: string): string {
        return adr;
    }


    static checkUri(uri: string): void {
        if(uri.indexOf('\0') !== -1)
            throw new ProtocolException("path contains null byte")

        for(let i = 0; i < uri.length; i++) {
            let ch = uri.charCodeAt(i)
            if(ch < 0x20 || ch === 0x7F)
                throw new ProtocolException("path contains control character")
        }
    }

    private static readonly TOKEN_PATTERN = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/

    static checkMethod(method: string): void {
        if(!HttpUtil.TOKEN_PATTERN.test(method))
            throw new ProtocolException("Invalid method: " + method)
    }
}