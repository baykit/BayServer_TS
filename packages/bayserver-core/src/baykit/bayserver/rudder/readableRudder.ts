import {Rudder} from "./rudder";
import {Buffer} from "buffer";
import {Readable} from "stream";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {IOException} from "../util/ioException";

export class ReadableRudder extends Rudder {
    readable: Readable

    constructor(readable: Readable) {
        super();
        this.readable = readable;
        this.readable.on('data', (buf: Buffer) => {
            if(this.readHandler != null) {
                try {
                    BayLog.debug("%s DATA", this)
                    this.readHandler(buf, buf.length)
                }
                catch(e) {
                    BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
                }
            }
        })

        this.readable.on('end', () => {
            if(this.readHandler != null) {
                BayLog.debug("%s EOF", this)
                try {
                    this.readHandler(Buffer.alloc(0), 0)
                }
                catch(e) {
                    BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
                }
            }
        })

        this.readable.on('close', (hasError: boolean = false) => {
            if(this.closeHandler != null) {
                try {
                    this.closeHandler()
                }
                catch(e) {
                    BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
                }
            }
        });

        this.readable.on("error", (err) => {
            if(this.errorHandler != null) {
                try {
                    BayLog.debug("%s Error on read: %s", this, err.message)
                    this.errorHandler(new IOException(err.message))
                }
                catch(e) {
                    BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
                }
            }
        })
    }

    key(): Object {
        return this.readable;
    }

    reqRead(buf: Buffer): void {
        this.readable.resume()
    }

    pause(): void {
        this.readable.pause()
    }

    reqWrite(buf: Buffer): void {
        throw new Sink()
    }

    reqClose(): void {
        this.readable.destroy() // 'close' event will occur
    }
}