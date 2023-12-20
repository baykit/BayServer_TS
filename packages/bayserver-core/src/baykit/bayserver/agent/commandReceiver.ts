import {GrandAgent} from "./grandAgent";
import * as net from "net";
import {BayLog} from "../bayLog";
import {IOException} from "../util/ioException";
import {IOUtil} from "../util/ioUtil";

export class CommandReceiver {
    agent: GrandAgent;
    communicationChannel: net.Socket;

    constructor(agent: GrandAgent, commCh: net.Socket) {
        this.agent = agent;
        BayLog.debug("%s Start", this)
        this.communicationChannel = commCh
        this.communicationChannel.on('data', (buf: Buffer) => {
            this.onRead(buf)
        })
        this.communicationChannel.on('error', (err) => {
            BayLog.error_e(err, "%s Communication error", this)
            this.close()
        })
        this.communicationChannel.on('close', () => {
            BayLog.debug("%s communication channel closed", this)
            this.agent.abort()
        })
    }

    toString(): string {
        return "ComReceiver#" + this.agent.agentId;
    }

    onRead(buf: Buffer): void  {
        try {
            let pos = 0
            while(pos < buf.length) {
                let data64 = IOUtil.readInt64(buf, pos)
                //BayLog.debug("%s receive data %s", this.agent, data64);
                let cmd = Number(data64 >> BigInt(48))
                let arg1 = Number(data64 >> BigInt(32) & BigInt(0xffff))
                let arg2 = Number(data64 >> BigInt(16) & BigInt(0xffff))
                let arg3 = Number(data64 & BigInt(0xffff))

                BayLog.debug("%s receive command %d: args=(%d, %d, %d)", this.agent, cmd, arg1, arg2, arg3);
                switch (cmd) {
                    case GrandAgent.CMD_RELOAD_CERT:
                        this.agent.reloadCert();
                        break
                    case GrandAgent.CMD_MEM_USAGE:
                        this.agent.printUsage();
                        break
                    case GrandAgent.CMD_SHUTDOWN:
                        this.agent.reqShutdown();
                        return
                    case GrandAgent.CMD_ABORT:
                        this.agent.abort()   // -> exit if process mode
                        return
                    case GrandAgent.CMD_FORK:
                        this.agent.fork(arg1, arg2)   // -> exit if process mode
                        break
                    default:
                        BayLog.error("Unknown command: %d", cmd);
                }

                this.send(GrandAgent.CMD_OK);
                pos += 8
            }
        }
        catch(e) {
            if(e instanceof IOException)
                BayLog.error_e(e, "%s Command thread aborted(end)", this.agent);
            else
                throw e
        }
        finally {
            //BayLog.debug("%s Command ended", this);
        }
    }

    send(cmd: number) {
        BayLog.debug("%s send command %d", this, cmd);
        let data64 =
            (BigInt(cmd) << BigInt(48) & BigInt(0xffff000000000000))
        IOUtil.writeInt64(this.communicationChannel, data64);
    }

    end(): void
    {
        BayLog.debug("%s end", this);
        try {
            this.send(GrandAgent.CMD_CLOSE);
        }
        catch(e) {
            BayLog.error_e(e, "%s Write error", this.agent);
        }

        this.close()
    }

    close(): void {
        this.communicationChannel.end()
    }
}
