import {format} from "util";

export class BayException extends Error {

    public constructor(fmt: string = null, ...args: any[]) {
        if(fmt == null)
            super(null)
        else if(args == null || args.length == 0)
            super(format("%s", fmt))
        else
            super(format(fmt, ...args))
    }
}
