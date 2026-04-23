import {format} from "util";
import {IOException} from "../util/ioException";

/**
 * ProtocolException is thrown when protocol-level violations are detected,
 * such as invalid packet framing or incorrect packet ordering.
 * (Invalid HTTP headers or content length values result in an HttpException,
 * which causes a 400 Bad Request response to be returned to the client.)
 */
export class ProtocolException extends IOException {
    public constructor(fmt: string = null, ...args: any[]) {
        if(fmt == null)
            super(null)
        else if(args == null || args.length == 0)
            super(format("%s", fmt))
        else
            super(format(fmt, ...args))
    }
}