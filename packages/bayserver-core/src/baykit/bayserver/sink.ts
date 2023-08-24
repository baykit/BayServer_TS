import {format} from "util";


export class Sink extends Error {

    public constructor(fmt: string = null, ...args: any[]) {
        if(fmt == null)
            super()
        else if(args == null || args.length == 0)
            super(format("%s", fmt))
        else
            super(format(fmt, ...args))
    }
}