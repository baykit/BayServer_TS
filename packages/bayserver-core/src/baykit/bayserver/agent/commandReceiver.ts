import {GrandAgent} from "./grandAgent";
import {BayLog} from "../bayLog";
import {IOException} from "../util/ioException";
import {IOUtil} from "../util/ioUtil";
import {Ship} from "../ship/ship";
import {Transporter} from "./multiplexer/transporter";
import {Rudder} from "../rudder/rudder";
import {SocketRudder} from "../rudder/socketRudder";
import {Sink} from "../sink";
import {NextSocketAction} from "./nextSocketAction";
import {Socket} from "net";
import {ProtocolException} from "../protocol/protocolException";

export class CommandReceiver extends Ship {


    closed: boolean = false

    init(agtId: number, rd: Rudder, tp: Transporter) {
        super.init(agtId, rd, tp)
    }

    toString(): string {
        return "ComRecv(agt#" + this.agentId + ")";
    }

    //////////////////////////////////////////////////////
    // Implements ship
    //////////////////////////////////////////////////////
    notifyHandshakeDone(protocol: string): number {
        throw new Sink()
    }

    notifyConnect(): number {
        throw new Sink()
    }

    notifyRead(buf: Buffer): number {
        BayLog.debug("%s notifyRead len=%d", this, buf.length)
        let pos = 0
        while(pos < buf.length) {
            let data64 = IOUtil.readInt64(buf, pos)
            this.onReadCommand(data64)
            pos += 8
        }
        return NextSocketAction.CONTINUE
    }

    notifyEof(): number {
        return -1
    }

    notifyError(err: Error): void {
        BayLog.error_e(err)
    }

    notifyProtocolError(e: ProtocolException): boolean {
        throw new Sink()
    }

    notifyClose(): void {
    }

    checkTimeout(durationSec: number): boolean {
        return false
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    onReadCommand(data64: bigint): void  {
        let agt = GrandAgent.get(this.agentId)

        try {
            //BayLog.debug("%s receive data %s", this.agent, data64);
            let cmd = Number(data64 >> BigInt(48))
            let arg1 = Number(data64 >> BigInt(32) & BigInt(0xffff))
            let arg2 = Number(data64 >> BigInt(16) & BigInt(0xffff))
            let arg3 = Number(data64 & BigInt(0xffff))

            BayLog.debug("%s receive command %d: args=(%d, %d, %d)", this, cmd, arg1, arg2, arg3);
            switch (cmd) {
                case GrandAgent.CMD_RELOAD_CERT:
                    agt.reloadCert();
                    break
                case GrandAgent.CMD_MEM_USAGE:
                    agt.printUsage();
                    break
                case GrandAgent.CMD_SHUTDOWN:
                    agt.reqShutdown();
                    return
                case GrandAgent.CMD_ABORT:
                    agt.abort()   // -> exit if process mode
                    return
                case GrandAgent.CMD_FORK:
                    agt.fork(arg1, arg2)   // -> exit if process mode
                    break
                default:
                    BayLog.error("Unknown command: %d", cmd);
            }

            this.sendCommandToMonitor(GrandAgent.CMD_OK);
        }
        catch(e) {
            BayLog.error_e(e);
            if(e instanceof IOException)
                BayLog.error_e(e, "%s Command thread aborted(end)", this);
            else
                throw e
        }
        finally {
            BayLog.debug("%s Command ended", this);
        }
    }

    sendCommandToMonitor(cmd: number) {
        BayLog.debug("%s send command %d", this, cmd);
        let data64 =
            (BigInt(cmd) << BigInt(48) & BigInt(0xffff000000000000))
        if(this.rudder instanceof SocketRudder) {
            IOUtil.writeInt64(this.rudder.readable as Socket, data64);
        }
        else {
            throw new Sink()
        }
    }

    end(): void
    {
        BayLog.debug("%s end", this);
        try {
            this.sendCommandToMonitor(GrandAgent.CMD_CLOSE);
        }
        catch(e) {
            BayLog.error_e(e, "agt#%d Write error", this.agentId);
        }

        this.close()
    }

    close(): void {
        if(this.closed)
            return

        let agt = GrandAgent.get(this.agentId)
        agt.netMultiplexer.reqClose(this.rudder)
    }
}
