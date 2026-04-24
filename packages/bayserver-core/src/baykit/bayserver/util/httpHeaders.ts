import {HttpStatus} from "./httpStatus";
import {StrUtil} from "./strUtil";
import {ArrayUtil} from "./arrayUtil";

export class HttpHeaders {
    /**
     * Known header names
     */
    static readonly HEADER_SEPARATOR: string = ": "
    static readonly HEADER_SEPARATOR_BYTES = HttpHeaders.HEADER_SEPARATOR.charCodeAt(0);

    static readonly CONTENT_TYPE: string = "content-type";
    static readonly CONTENT_LENGTH: string = "content-length";
    static readonly CONTENT_ENCODING: string = "content-encoding";
    static readonly HDR_TRANSFER_ENCODING: string = "Transfer-Encoding";
    static readonly CONNECTION: string = "connection";
    static readonly AUTHORIZATION: string = "authorization";
    static readonly WWW_AUTHENTICATE: string = "WWW-Authenticate";
    static readonly STATUS: string = "Status";
    static readonly LOCATION: string = "Location";
    static readonly HOST: string = "host";
    static readonly COOKIE: string = "Cookie";
    static readonly USER_AGENT: string = "User-Agent";
    static readonly ACCEPT: string = "Accept";
    static readonly ACCEPT_LANGUAGE: string = "accept-language";
    static readonly ACCEPT_ENCODING: string = "accept-encoding";
    static readonly UPGRADE_INSECURE_REQUESTS: string = "Upgrade-Insecure-Requests";
    static readonly SERVER: string = "Server";
    static readonly X_FORWARDED_HOST: string = "x-forwarded-host";
    static readonly X_FORWARDED_FOR: string = "x-forwarded-for";
    static readonly X_FORWARDED_PROTO: string = "x-forwarded-proto";
    static readonly X_FORWARDED_PORT: string = "x-forwarded-port";

    static readonly CONNECTION_CLOSE: number = 1;
    static readonly CONNECTION_KEEP_ALIVE: number = 2;
    static readonly CONNECTION_UPGRADE: number = 3;
    static readonly CONNECTION_UNKOWN: number = 4;

    /** Status */
    status: number = HttpStatus.OK;

    /** Header hash */
    headers: Map<string, string[]> = null

    constructor() {
        this.headers = new Map()
    }

    toString(): string {
        return "Headers(s=" + this.status + " h=" + this.headers;
    }

    copyTo(dst: HttpHeaders) {
        dst.status = this.status;
        for(const [name, values] of this.headers) {
            let newValues = [...values]
            dst.headers.set(name, newValues)
        }
    }

    /**
     * Get the header value as string
     */
    get(name: string): string {
        if (name == null)
            throw new Error("nullPo");

        return this.getFast(StrUtil.toLowerCase(name))
    }

    /**
     * Get the header value as string (Fast version)
     */
    getFast(name: string): string {
        if (name == null)
            throw new Error("nullPo");

        let values = this.headers.get(name)
        if(values == null)
            return null;
        return values[0];
    }

    /**
     * Get the header value as int
     */
    getInt(name: string): number {
        let val = this.get(name);
        if (val == null)
            return -1;
        else
            return Number.parseInt(val);
    }

    /**
     * Update the header value by string
     */
    set(name: string, value: string) {
        if (name == null)
            throw new Error("nullPo")
        if (value == null)
            throw new Error("nullPo")

        this.setFast(StrUtil.toLowerCase(name), value)
    }

    /**
     * Update the header value by string (Fast version)
     */
    setFast(name: string, value: string) {
        if (name == null)
            throw new Error("nullPo")
        if (value == null)
            throw new Error("nullPo")

        let values = this.headers.get(name);
        if(values == null) {
            values = [];
            this.headers.set(name, values)
        }
        values.length = 0;
        values.push(value);
    }

    /**
     * Add a header value by string
     */
    add(name: string, value: string) {
        if (name == null || value == null)
            throw new Error("nullPo")

        let key = StrUtil.toLowerCase(name);
        let values = this.headers.get(key);
        if(values == null) {
            values = []
            this.headers.set(key, values)
        }
        values.push(value);
    }

    /**
     * Get all the header name
     */
    names(): string[] {
        let names = [];
        for(const name of this.headers.keys()) {
            names.push(name);
        }
        return names;
    }

    /**
     * Get all the header values of specified header name
     */
    values(name: string): string[] {
        let values = this.headers.get(StrUtil.toLowerCase(name))
        if(values == null)
            return [];
        else
            return values;
    }

    /**
     * Check the existence of header
     */
    contains(name: string): boolean {
        if (name == null)
            throw new Error("nullPo")

        return this.headers.has(StrUtil.toLowerCase(name))
    }

    remove(name) {
        if (name == null)
            throw new Error("nullPo")

        this.headers.delete(name)
    }

    //////////////////////////////////////////////////////
    // Useful methods
    //////////////////////////////////////////////////////
    contentType(): string {
        return this.getFast(HttpHeaders.CONTENT_TYPE);
    }

    setContentType(type: string) {
        this.setFast(HttpHeaders.CONTENT_TYPE, type);
    }

    /**
     * Get content length
     *
     * @return content length. If there isn't a content length header, return
     *         -1.
     */
    contentLength(): number {
        let length = this.getFast(HttpHeaders.CONTENT_LENGTH);
        if (StrUtil.empty(length))
            return -1;
        else
            return Number.parseInt(length);
    }

    setContentLength(length: number) {
        this.setFast(HttpHeaders.CONTENT_LENGTH, length.toString());
    }

    getConnection() {
        let con = this.getFast(HttpHeaders.CONNECTION);
        if (con !== null)
            con = StrUtil.toLowerCase(con);

        switch (con) {
            case "close":
                return HttpHeaders.CONNECTION_CLOSE;
            case "keep-alive":
                return HttpHeaders.CONNECTION_KEEP_ALIVE;
            case "upgrade":
                return HttpHeaders.CONNECTION_UPGRADE;
            default:
                return HttpHeaders.CONNECTION_UNKOWN;
        }
    }


    clear() {
        this.headers.clear()
        this.status = HttpStatus.OK;
    }
}