import {BayException} from "./bayException";
import {HttpStatus} from "./util/httpStatus";
import {format} from "util";

export class HttpException extends BayException {

    status: number; // HTTP status
    location: string; // for 302

    constructor(status: number, fmt: string = null, ...args: any[]) {
        if (status < 300 || status >= 600)
            throw new Error("Illegal Http error status code: " + status);

        var msg: string;
        if (fmt == null)
            msg = ""
        else if (args == null)
            msg = fmt
        else
            msg = format(fmt, ...args)

        super("HTTP %d %s: %s", status, HttpStatus.description(status), msg);
        this.status = status;
    }

    static movedTemp(location: string): HttpException {
        let e = new HttpException(HttpStatus.MOVED_TEMPORARILY, location);
        e.location = location;
        return e;
    }
}