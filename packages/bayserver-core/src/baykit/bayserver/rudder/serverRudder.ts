import {Rudder} from "./rudder";
import {Server} from "net";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {IOException} from "../util/ioException";

export class ServerRudder extends Rudder {

    server: Server

    constructor(server: Server) {
        super()
        this.server = server;

        this.server.on('close', (hasError: boolean) => {
            try {
                if(this.closeHandler != null)
                    this.closeHandler()
            }
            catch(e) {
                BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
            }
        });

        this.server.on("error", (err) => {
            try {
                BayLog.debug("%s Error on read: %s", this, err.message)
                if(this.errorHandler != null)
                    this.errorHandler(new IOException(err.message))
            }
            catch(e) {
                BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
            }
        })
    }

    key(): Object {
        return this.server;
    }

    reqRead(buf): void {
        throw new Sink()
    }

    reqWrite(buf): void {
        throw new Sink()
    }

    pause(): void {
    }

    reqClose(): void {
        this.server.close()
    }

}