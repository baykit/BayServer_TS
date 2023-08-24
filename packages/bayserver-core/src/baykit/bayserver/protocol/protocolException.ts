import {format} from "util";
import {IOException} from "../util/ioException";

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