import {Buffer} from "buffer";
import {Socket} from "net";
import {ReadableRudder} from "./readableRudder";
import {BayLog} from "../bayLog";

export class SocketRudder extends ReadableRudder {

    constructor(socket: Socket) {
        super(socket)
    }

    reqWrite(buf: Buffer): void {
        let skt = this.readable as Socket
        skt.write(buf, (e) => {
            try {
                if(e) {
                    if(this.errorHandler != null)
                        this.errorHandler(e)
                }
                else {
                    if(this.writeHandler != null)
                        this.writeHandler(buf.length)
                }
            }
            catch(e) {
                BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
            }
        })
    }

    socket() : Socket {
        return this.readable as Socket
    }

    getRemoteAddress(): string {
        return this.socket().remoteAddress
    }
}