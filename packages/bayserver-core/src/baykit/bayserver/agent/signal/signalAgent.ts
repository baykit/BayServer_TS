import {SysUtil} from "../../util/sysUtil";
import {SignalProxy} from "./signalProxy";
import * as net from "net";
import {BayLog} from "../../bayLog";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {StrUtil} from "../../util/strUtil";
import {GrandAgentMonitor} from "../grandAgentMonitor";
import {Server} from "net";

export class SignalAgent {
    static readonly COMMAND_RELOAD_CERT: string = "reloadcert";
    static readonly COMMAND_MEM_USAGE: string = "memusage";
    static readonly COMMAND_RESTART_AGENTS: string = "restartagents";
    static readonly COMMAND_SHUTDOWN: string = "shutdown";
    static readonly COMMAND_ABORT: string = "abort";

    static commands: string[] = [
        this.COMMAND_RELOAD_CERT,
        this.COMMAND_MEM_USAGE,
        this.COMMAND_RESTART_AGENTS,
        this.COMMAND_SHUTDOWN,
        this.COMMAND_ABORT
    ]

    static signalAgent: SignalAgent
    private static signalMap: Map<string, string> = null
    port: number
    serverSocket: net.Server

    constructor(port) {
        this.port = port;
        BayLog.info( BayMessage.get(Symbol.MSG_OPEN_CTL_PORT, port));
        this.serverSocket = new Server((skt) => {
            skt.on("data", (buf: Buffer) => {
                let cmd = buf.toString().trim()
                SignalAgent.handleCommand(cmd)
                skt.write("OK")
            })
        })
        this.serverSocket.listen(port, () => {
            BayLog.info("Port opened: %s", this.serverSocket.address())
        });
        this.serverSocket.on("error", (err) => {
            BayLog.error("Open failed")
            BayLog.error_e(err)
        });
    }

    static init(port: number): void {
        if(port > 0) {
            this.signalAgent = new SignalAgent(port);
        }
        else {
            let sp: SignalProxy = SignalProxy.getProxy();
            if (sp != null) {
                for (const cmd of this.commands) {
                    sp.register(this.getSignalFromCommand(cmd), () => {
                        this.handleCommand(cmd)
                    });
                }
            }
        }
    }

    static initSignalMap(): void {
        if(this.signalMap != null)
            return;

        this.signalMap = new Map()
        if(SysUtil.runOnWindows()) {
            /** Available signals on Windows
             SIGABRT
             SIGFPE
             SIGILL
             SIGINT
             SIGSEGV
             SIGTERM
             */
            this.signalMap.set("SIGSEGV", this.COMMAND_RELOAD_CERT)
            this.signalMap.set("SIGILL", this.COMMAND_MEM_USAGE)
            this.signalMap.set("SIGINT", this.COMMAND_SHUTDOWN)
            this.signalMap.set("SIGTERM", this.COMMAND_RESTART_AGENTS)
            this.signalMap.set("SIGABRT", this.COMMAND_ABORT)
        }
        else {
            this.signalMap.set("SIGALRM", this.COMMAND_RELOAD_CERT)
            this.signalMap.set("SIGTRAP", this.COMMAND_MEM_USAGE)
            this.signalMap.set("SIGHUP", this.COMMAND_RESTART_AGENTS)
            this.signalMap.set("SIGTERM", this.COMMAND_SHUTDOWN)
            this.signalMap.set("SIGABRT", this.COMMAND_ABORT)
        }
    }

    static handleCommand(cmd: string): void {
        BayLog.debug("handle command: %s", cmd);
        try {
            switch (cmd.toLowerCase()) {
                case this.COMMAND_RELOAD_CERT:
                GrandAgentMonitor.reloadCertAll();
                break;
            case this.COMMAND_MEM_USAGE:
                GrandAgentMonitor.printUsageAll();
                break;
            case this.COMMAND_RESTART_AGENTS:
                try {
                    GrandAgentMonitor.restartAll();
                } catch (e) {
                    BayLog.error(e);
                }
                break;
            case this.COMMAND_SHUTDOWN:
                GrandAgentMonitor.shutdownAll();
                break;
            case this.COMMAND_ABORT:
                GrandAgentMonitor.abortAll();
                break;
            default:
                BayLog.error("Unknown command: " + cmd);
                break;
            }
        }
        catch(e) {
            BayLog.error_e(e);
        }
    }

    static getSignalFromCommand(command: string): string {
        this.initSignalMap();
        for(const [sig, com] of this.signalMap) {
            if(StrUtil.eqIgnoreCase(com, command))
                return sig;
        }
        return null;
    }
}