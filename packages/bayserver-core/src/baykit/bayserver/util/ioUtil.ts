import {Buffer} from "buffer";
import {CharUtil} from "./charUtil";
import * as net from "net";
import {BayLog} from "../bayLog";
import {BayMessage} from "../bayMessage";
import {Symbol} from "../symbol";
import {createServer} from "net";
import {BayException} from "../bayException";
import {IOException} from "./ioException";
import {exit} from "process";

export class IOUtil {
    public static readLine(r: Buffer): string {
        var line: number[] = []
        while(true) {
            let c = r.readInt8()
            if(c == null)
                break
            else if(c == CharUtil.LF_CODE)
                break
            else if(c == CharUtil.CR_CODE)
                continue
            line.push(c)
        }
        return String.fromCodePoint(...line)
    }

    static getSockRecvBufSize(skt: net.Socket) {
        return skt.writableLength
    }

    static readInt32(buf: Buffer): number{
        if(buf.length != 4)
            throw new IOException("Invalid buffer length: " + buf.length)

        return buf.readInt32BE(0);
    }

    static writeInt32(writeCh: net.Socket, data: number) {
        let buf: Buffer = Buffer.alloc(4)
        buf.writeInt32BE(data)
        writeCh.write(buf)
    }

    static readInt64(buf: Buffer, pos: number): bigint {
        if(buf.length - pos < 8)
            throw new IOException("Invalid buffer length: " + buf.length)

        return buf.readBigUInt64BE(pos);
    }

    static writeInt64(writeCh: net.Socket, data: bigint) {
        let buf: Buffer = Buffer.alloc(8)
        buf.writeBigUInt64BE(data)
        writeCh.write(buf)
    }

    static openLocalPipe(
        serverSideSocketCatcher: (skt: net.Socket) => void,
        clientSideSocketCatcher: (skt: net.Socket) => void): void {
        // Dynamic and/or Private Ports (49152-65535)
        // https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml

        let DYNAMIC_PORTS_START = 49152
        for(let i: number = DYNAMIC_PORTS_START; i < 65535 + 1; i++) {
            try {
                this.openLocalPipeByPort(i, serverSideSocketCatcher, clientSideSocketCatcher)
                return
            }
            catch(e) {
                BayLog.error_e(e)
                continue
            }
        }

        throw new BayException("Cannot create local pipe")
    }

    private static openLocalPipeByPort(
        portNum: number,
        serverSideSocketCatcher: (skt: net.Socket) => void,
        clientSideSocketCatcher: (skt: net.Socket) => void) : void {
        let localhost = "127.0.0.1"

        let serverSkt = createServer((skt) => {
            serverSideSocketCatcher(skt)
            if(true) {
                BayLog.debug(BayMessage.get(Symbol.MSG_CLOSING_LOCAL_PORT, portNum))
                serverSkt.close()
            }
        })

        serverSkt.on('error', (err) => {
            //BayLog.error_e(err, "Server side")
            if(portNum == 65535) {
                this.openFail()
            }
            this.openLocalPipeByPort(portNum + 1, serverSideSocketCatcher, clientSideSocketCatcher)
        })

        serverSkt.listen(portNum, "127.0.0.1", () => {
            BayLog.debug(BayMessage.get(Symbol.MSG_OPENING_LOCAL_PORT, portNum))
            // Connect from client
            let clientSideSkt = net.connect(portNum, "127.0.0.1", () => {
                clientSideSocketCatcher(clientSideSkt)
            });
            clientSideSkt.on('error', (err) => {
                if(portNum == 65535)
                    this.openFail()
            })
        })
    }


    private static openFail() {
        BayLog.error("Failed to open local port")
        exit(1)
    }
}