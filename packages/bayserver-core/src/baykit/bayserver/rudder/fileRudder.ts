import {Rudder} from "./rudder";
import {Buffer} from "buffer";
import * as fs from "fs";
import {BayLog} from "../bayLog";

export class FileRudder extends Rudder {

    fd: number

    constructor(fd: number) {
        super()
        this.fd = fd;
    }

    key(): Object {
        return this.fd
    }

    reqRead(buf: Buffer): void {
        fs.read(this.fd, buf, 0, buf.length, -1, (err: Error, bytesRead: number, buffer: Buffer) => {
            try {
                if(err) {
                    this.errorHandler(err)
                }
                else {
                    this.readHandler(buffer.slice(0, bytesRead), bytesRead)
                }
            }
            catch(e) {
                BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
            }
        })
    }

    reqWrite(buf: Buffer): void {
        fs.write(this.fd, buf, 0, buf.length, (err: Error, written: number) => {
            try {
                if(err) {
                    this.errorHandler(err)
                }
                else {
                    this.writeHandler(written)
                }
            }
            catch(e) {
                BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
            }
        })
    }

    reqClose(): void {
        fs.close(this.fd, err => {
            try {
                if(err) {
                    this.errorHandler(err)
                }
                this.closeHandler()
            }
            catch(e) {
                BayLog.fatal_e(e, "%s Cannot handle exception!!", this)
            }
        })
    }
}