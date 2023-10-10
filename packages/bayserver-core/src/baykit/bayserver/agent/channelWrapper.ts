import {Readable} from "stream";
import * as net from "net";

export class ChannelWrapper {

    static readonly TYPE_SOCKET: number = 1
    static readonly TYPE_READABLE: number = 2
    static readonly TYPE_FD: number = 3

    type: number
    socket: net.Socket
    readable: Readable
    fd: number

    constructor(ch: net.Socket | Readable | number) {
        if (ch instanceof net.Socket) {
            this.type = ChannelWrapper.TYPE_SOCKET
            this.socket = ch
        } else if (ch instanceof Readable) {
            this.type = ChannelWrapper.TYPE_READABLE
            this.readable = ch
        } else {
            this.type = ChannelWrapper.TYPE_FD
            this.fd = ch
        }
    }

    toString(): string {
        if (this.type == ChannelWrapper.TYPE_SOCKET) {
            return this.socket.toString()
        } else if (this.type == ChannelWrapper.TYPE_READABLE) {
            return this.readable.toString()
        } else {
            return this.fd.toString()
        }
    }
}