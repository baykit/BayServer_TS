import {PortMapItem} from "./portMapItem";
import {BayLog} from "../bayLog";
import * as net from "net";
import {AcceptHandler} from "./acceptHandler";
import {LifeCycleListener} from "./lifeCycleListener";
import {NonBlockingHandler} from "./nonBlockingHandler";
import {MemUsage} from "../memUsage";
import {CommandReceiver} from "./commandReceiver";
import {BayServer} from "../bayserver";
import {exit} from "process";
import {fork} from "child_process";


export class GrandAgent {

    static readonly CMD_OK = 0
    static readonly CMD_CLOSE = 1
    static readonly CMD_RELOAD_CERT = 2
    static readonly CMD_MEM_USAGE = 3
    static readonly CMD_SHUTDOWN = 4
    static readonly CMD_ABORT = 5
    static readonly CMD_FORK = 6

    static agentCount: number
    static maxAgentId: number = 0
    static maxShips: number
    static multiCore: boolean

    private static agents: Map<number, GrandAgent> = null

    static listeners: LifeCycleListener[] = [];

    agentId: number
    nonBlockingHandler: NonBlockingHandler
    acceptHandler: AcceptHandler
    maxInboundShips: number
    anchorable: boolean;

    static anchorablePortMap: PortMapItem[]  // TCP Server ports
    static unanchorablePortMap: PortMapItem[] // UDP Server ports

    commandReceiver: CommandReceiver
    aborted: boolean = false


    private constructor(
        agentId: number,
        maxShips: number,
        anchorable: boolean) {
        this.agentId = agentId

        if(anchorable) {
            this.acceptHandler = new AcceptHandler(this, GrandAgent.anchorablePortMap);
        }

        this.anchorable = anchorable
        this.nonBlockingHandler = new NonBlockingHandler(this)
        this.maxInboundShips = maxShips
    }

    toString(): string {
        return "agt#" + this.agentId
    }

    reloadCert() {

    }

    printUsage() {
        // print memory usage
        BayLog.info("Agent#%d MemUsage", this.agentId);
        MemUsage.get(this.agentId).printUsage(1);
    }

    shutdown() {
        BayLog.debug("%s shutdown", this);
        if(this.acceptHandler != null)
            this.acceptHandler.shutdown();
        this.abort(null, 0)
    }

    abort(err: Error = null, status: number = 1) {
        if(err) {
            BayLog.fatal("%s abort", this)
            BayLog.fatal_e(err)
        }

        this.commandReceiver.end()
        for(const lis of GrandAgent.listeners)
            lis.remove(this.agentId)

        GrandAgent.agents.delete(this.agentId)

        if(BayServer.harbor.isMultiCore())
            setTimeout(() => {
                exit(status)
            }, 5000)
        else
            this.clean()
        this.aborted = true
    }

    fork(agentId: number, monitorPort: number) {
        let newArgv = []
        for (const arg of BayServer.scriptArgs) {
            if (!arg.startsWith("-agentid=") &&
                !arg.startsWith("-monitorPort=") &&
                !arg.startsWith("-openPort"))
                newArgv.push(arg)
        }
        newArgv.push("-agentid=" + agentId)
        newArgv.push("-monitorPort=" + monitorPort)
        let child = fork(BayServer.scriptName, newArgv)
        BayLog.debug("agt#%d Child process spawned: child agt#%d pid=%d", this.agentId, agentId, child.pid)

        child.on("exit", (code, signal) => {
            BayLog.debug("agt#%d child agt#%d is exited: code=%d sig=%d", this.agentId, agentId, code, signal)
        })

        for (const portDkr of GrandAgent.anchorablePortMap) {
            //BayLog.debug("agt#%d send server socket: child agt#%d port=%d", this.agentId, agentId, portDkr.docker.getPort())
            child.send("serverSocket", portDkr.ch)
        }
    }

    private clean() {
        this.nonBlockingHandler.closeAll()
        this.agentId = -1
    }

    //////////////////////////////////////////////////////
    // Static methods
    //////////////////////////////////////////////////////
    static init(agtIds: number[], anchorablePortMap: PortMapItem[], unanchorablePortMap: PortMapItem[], maxShips: number, multiCore: boolean) {
        this.agentCount = agtIds.length;
        this.maxShips = maxShips;
        this.multiCore = multiCore;
        this.anchorablePortMap = anchorablePortMap
        this.agents = new Map()

        for(const agtId of agtIds) {
            this.add(agtId, true);
        }
    }

    static get(agentId: number): GrandAgent {
        return this.agents.get(agentId)
    }

    static getByIndex(idx: number) {
        let agents = Array.from(this.agents.values())
        return agents[idx]
    }

    static add(agentId: number, anchorable: boolean) {
        if(agentId == -1)
            agentId = this.maxAgentId + 1
        //BayLog.debug("Add agent: id=%d", agentId);
        if(agentId > this.maxAgentId)
            this.maxAgentId = agentId

        // Agents run on multi core (process mode)
        let agt: GrandAgent = new GrandAgent(agentId, this.maxShips, anchorable);
        this.agents.set(agentId, agt)

        for(const lis of this.listeners) {
            lis.add(agentId)
        }
    }

    static addLifecycleListener(listener: LifeCycleListener) {
        this.listeners.push(listener)
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    runCommandReceiver(commCh: net.Socket) {
        this.commandReceiver = new CommandReceiver(this, commCh)
    }


}
