import {fork} from "child_process";
import {BayLog} from "../bayLog";
import {BayServer} from "../bayserver";
import {PortMapItem} from "./portMapItem";
import {IOUtil} from "../util/ioUtil";
import * as net from "net";
import {GrandAgent} from "./grandAgent";
import {BayMessage} from "../bayMessage";
import {Symbol} from "../symbol"
import {exit} from "process";
import {AddressInfo, createServer} from "net";
export class GrandAgentMonitor {

    static readonly AGENT_SHUTDOWN_WAIT = 3000

    static numAgents: number
    static curId: number = 1
    static anchoredPortMap: PortMapItem[]   // TCP Port map

    static monitors: Map<number, GrandAgentMonitor> = null

    static finale: boolean


    agentId: number
    anchorable: boolean; // is TCP server?
    communicationChannel: net.Socket;


    constructor(agentId: number, anchorable: boolean, comChannel: net.Socket) {
        this.agentId = agentId;
        this.anchorable = anchorable;
        this.communicationChannel = comChannel
        this.communicationChannel.on("data", (buf: Buffer) => {
            this.onRead(buf)
        })
        this.communicationChannel.on("end", () => {
            BayLog.info( "%s Communication lost: agt#%d", this, agentId)
            GrandAgentMonitor.agentAborted(agentId, anchorable)
        })
        this.communicationChannel.on("error", (e) => {
            BayLog.error_e(e, "%s Communication error", this)
            GrandAgentMonitor.agentAborted(this.agentId, this.anchorable)
        })
    }

    toString(){
        return "Monitor#" + this.agentId;
    }


    onRead(buf: Buffer): void {
        let pos = 0
        while(pos < buf.length) {
            let close: boolean = false
            if (buf.length == 0)
                close = true
            else {
                let res = IOUtil.readInt64(buf, pos);
                let cmd = Number(res >> BigInt(48))
                if (cmd == GrandAgent.CMD_CLOSE)
                    close = true
            }

            if(close) {
                BayLog.debug("%s read Close", this);
                GrandAgentMonitor.agentAborted(this.agentId, this.anchorable);
            }
            else {
                BayLog.debug("%s read OK", this);
            }
            pos += 8
        }
    }

    public reloadCert(): void {
        BayLog.debug("%s send reload command", this);
        this.send(GrandAgent.CMD_RELOAD_CERT);
    }

    public printUsage(): void {
        BayLog.debug("%s send mem_usage command", this);
        this.send(GrandAgent.CMD_MEM_USAGE);
    }

    shutdown(): void {
        BayLog.debug("%s send shutdown command", this);
        this.send(GrandAgent.CMD_SHUTDOWN);
    }

    abort(): void {
        BayLog.debug("%s send abort command", this);
        try {
            this.send(GrandAgent.CMD_ABORT);
        }
        catch(e) {
            BayLog.error_e(e);
        }
    }

    send(cmd: number, arg1: number = 0, arg2: number = 0, arg3: number = 0): void{
        BayLog.debug("%s send command %d: arg=(%d, %d, %d)", this, cmd, arg1, arg2, arg3);
        let data64 =
            (BigInt(cmd) << BigInt(48) & BigInt(0xffff000000000000)) |
            (BigInt(arg1) << BigInt(32) & BigInt(0xffff00000000)) |
            (BigInt(arg2) << BigInt(16) & BigInt(0xffff0000)) |
            (BigInt(arg3) & BigInt(0xffff))
        IOUtil.writeInt64(this.communicationChannel, data64);
    }

    close(): void {
        this.communicationChannel.end()
    }


    //////////////////////////////////////////////////////
    // Class methods
    //////////////////////////////////////////////////////

    static init(numAgents: number, anchoredPortMap: PortMapItem[]): void {
        BayLog.debug("Init GrandAgentMonitor numAgents=%d", numAgents)
        this.numAgents = numAgents
        this.anchoredPortMap = anchoredPortMap
        this.monitors = new Map()
        this.add(true, true, () => {
            for(let i = 1; i < this.numAgents; i++) {
                this.add(true, false, null)
            }
        })
    }

    static add(anchorable: boolean, openSocket: boolean, callback: () => void) {
        let agentId: number = this.curId++
        BayLog.debug("GrandAgentMonitor::Add agent id=%d", agentId)

        if(BayServer.harbor.isMultiCore()) {
            let serverSkt = createServer((skt) => {
                this.monitors.set(agentId, new GrandAgentMonitor(agentId, anchorable, skt))
                //BayLog.debug("Connected from agt#%d", agentId)
                BayLog.trace(BayMessage.get(Symbol.MSG_CLOSING_LOCAL_PORT, (serverSkt.address() as AddressInfo).port))
                serverSkt.close()
                if(callback != null) {
                    callback()
                }
            })

            serverSkt.listen(0, () => {
                const port = (serverSkt.address() as AddressInfo).port;
                BayLog.trace("open port for child agt#%d: %d", agentId, port);

                if(openSocket) {
                    let newArgv = [...BayServer.scriptArgs]
                    newArgv.push("-agentid=" + agentId)
                    newArgv.push("-monitorPort=" + port)
                    newArgv.push("-openPort")
                    let child = fork(BayServer.scriptName, newArgv)
                    BayLog.debug("Child process spawned: child agt#%d pid=%d", agentId, child.pid)

                    child.on("exit", (code) => {
                        BayLog.debug("agt#%d is exited: %d", agentId, code)
                        this.agentAborted(agentId, anchorable)
                    })
                }
                else {
                    for(const [_, mon] of this.monitors) {
                        BayLog.debug("Send fork command: to agt#%d, child agt#%d", mon.agentId, agentId)
                        mon.send(GrandAgent.CMD_FORK, agentId, port)
                        break
                    }
                }
            });
        }
        else {
            for (const portDkr of this.anchoredPortMap) {
                IOUtil.openLocalPipe(
                    (serverSideSocket) => {
                        let agt = GrandAgent.get(agentId)
                        agt.runCommandReceiver(serverSideSocket as net.Socket)
                    },
                    (clientSideSocket) => {
                        this.monitors.set(agentId, new GrandAgentMonitor(agentId, anchorable, clientSideSocket))
                    })
            }
        }
    }

    static printUsageAll(): void {
        for (const mon of this.monitors.values()) {
            try {
                mon.printUsage();
            } catch (e) {
                BayLog.error_e(e);
            }
        }
    }
    static reloadCertAll(): void {
        BayLog.debug("Reload all");
        for(const mon of this.monitors.values()) {
            mon.reloadCert();
        }
    }

    static restartAll(): void {
        BayLog.debug("Restart all");
        for(const mon of this.monitors.values())
            mon.shutdown();
    }

    static shutdownAll(): void {
        BayLog.debug("Shutdown all");
        this.finale = true;
        for(const mon of this.monitors.values())
            mon.shutdown();
        setTimeout(() => {
            exit(0)
        }, this.AGENT_SHUTDOWN_WAIT)
    }

    static abortAll(): void {
        BayLog.debug("Shutdown all");
        this.finale = true;
        for(const mon of this.monitors.values()) {
            mon.abort();
        }
        setTimeout(() => {
            exit(1)
        }, this.AGENT_SHUTDOWN_WAIT)
    }

    private static agentAborted(agtId: number, anchorable: boolean) {
        let mon = this.monitors.get(agtId)
        if(mon == null) {
            // already handled
            return
        }

        BayLog.info(BayMessage.get(Symbol.MSG_GRAND_AGENT_SHUTDOWN, agtId));

        this.monitors.delete(agtId)

        if(!this.finale) {
            if (this.monitors.size < this.numAgents) {
                try {
                    if(!BayServer.harbor.isMultiCore()) {
                        GrandAgent.add(-1, anchorable)
                    }
                    this.add(anchorable, false, null);
                } catch (e) {
                    BayLog.error_e(e);
                }
            }
        }
    }
}