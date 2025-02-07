import {env, exit} from 'process'
import { BayException } from './bayException';
import { BayLog } from './bayLog';
import { SysUtil } from './util/sysUtil';
import { sep } from 'path';
import 'source-map-support/register'
import { BayMessage } from './bayMessage';
import { Locale } from './util/locale';
import {BayDockers} from "./bayDockers";
import {Mimes} from "./util/mimes";
import {HttpStatus} from "./util/httpStatus";
import {BcfParser} from "./bcf/bcfParser";
import {BcfDocument} from "./bcf/bcfDocument";
import {BcfElement} from "./bcf/bcfElement";
import {Port} from "./docker/port";
import {City} from "./docker/city";
import {Harbor} from "./docker/harbor";
import {SignalAgent} from "./agent/signal/signalAgent";
import {Version} from "./version";
import {hostname} from "os";
import {Symbol} from "./symbol";
import {GrandAgent} from "./agent/grandAgent";
import {StrUtil} from "./util/strUtil";
import * as net from "net";
import path = require("path");
import {Cities} from "./util/cities";
import {PacketStore} from "./protocol/packetStore";
import {InboundShipStore} from "./common/inboundShipStore";
import {ProtocolHandlerStore} from "./protocol/protocolHandlerStore";
import {TourStore} from "./tour/tourStore";
import {MemUsage} from "./memUsage";
import {GrandAgentMonitor} from "./agent/monitor/grandAgentMonitor";
import * as fs from "fs";
import {SignalSender} from "./agent/signal/signalSender";
import {Md5Password} from "./util/md5Password";
import {IOException} from "./util/ioException";
import {Rudder} from "./rudder/rudder";
import {ServerRudder} from "./rudder/serverRudder";
import {SocketRudder} from "./rudder/socketRudder";
import {Server} from "net";
import {WriteStream} from "fs";
import {promisify} from "util";
import {finished} from 'stream';

export class BayServer {

    public static scriptName: string
    public static scriptArgs: string[]

    /** Host name */
    public static myHostName: string;

    /** BSERV_HOME directory */
    public static bservHome: string

    /** Configuration file name (full path) */
    public static bservPlan: string

    /** Conf files directory */
    public static bservLib: string

    private static softwareName: string;

    public static cities: Cities = new Cities();

    /** Port dockers */
    public static ports: Port[] = [];

    /** Harbor docker */
    public static harbor: Harbor;

    /** BayAgent */
    public static signalAgent: SignalAgent;

    /** Redirected output stream */
    public static logConsole: WriteStream

    /** Original console */
    public static originalConsoleLog: (message?: any, ...optionalParams: any[]) => void;
    public static originalConsoleError: (message?: any, ...optionalParams: any[]) => void;

    /** Port map */
    public static readonly anchorablePortMap: Map<Rudder, Port> = new Map();   // TCP server port map
    public static readonly unanchorablePortMap: Map<Rudder, Port> = new Map();   // TCP server port map

    public static main(args:string[]) {

        //BayLog.info("main: %s", args.join(","))
        this.scriptName = args[1];
        this.scriptArgs = [...args]
        this.scriptArgs.splice(0, 2)

        let cmd : string = null
        let home : string = env.BSERV_HOME
        let plan : string = env.BSERV_PLAN
        let mkpass : string = null
        let agentId: number = -1
        let openPort: boolean = false
        let monitorPort: number = -1
        let init: boolean = false

        for (const arg of args) {
            if (StrUtil.eqIgnoreCase(arg, "-start"))
                cmd = null;

            else if (StrUtil.eqIgnoreCase(arg, "-stop") || StrUtil.eqIgnoreCase(arg, "-shutdown"))
                cmd = SignalAgent.COMMAND_SHUTDOWN;

            else if (StrUtil.eqIgnoreCase(arg, "-restartAgents"))
                cmd = SignalAgent.COMMAND_RESTART_AGENTS;

            else if (StrUtil.eqIgnoreCase(arg, "-reloadCert"))
                cmd = SignalAgent.COMMAND_RELOAD_CERT;

            else if (StrUtil.eqIgnoreCase(arg, "-memUsage"))
                cmd = SignalAgent.COMMAND_MEM_USAGE;

            else if (StrUtil.eqIgnoreCase(arg, "-abort"))
                cmd = SignalAgent.COMMAND_ABORT;

            else if (StrUtil.eqIgnoreCase(arg, "-init"))
                init = true;

            else if (arg.toLowerCase().startsWith("-home="))
                home = arg.substring(6);

            else if (arg.toLowerCase().startsWith("-plan="))
                plan = arg.substring(6);

            else if (arg.toLowerCase().startsWith("-mkpass="))
                mkpass = arg.substring(8);

            else if (arg.toLowerCase().startsWith("-loglevel="))
                BayLog.setLogLevel(arg.substring(10));

            else if (arg.toLowerCase().startsWith("-agentid="))
                agentId = Number.parseInt(arg.substring(9));

            else if (StrUtil.eqIgnoreCase(arg, "-openPort"))
                openPort = true

            else if (arg.toLowerCase().startsWith("-monitorport="))
                monitorPort = Number.parseInt(arg.substring(13));
        }

        if(mkpass != null) {
            console.log(Md5Password.encode(mkpass))
            return;
        }

        Error.stackTraceLimit = Infinity
        if(agentId > 0)
            BayLog.debug("agt#%d Child process started", agentId)

        this.getHome(home)
        this.getLib()
        if(init) {
            this.init()
        }
        else {
            this.getPlan(plan)

            if (cmd == null) {
                BayServer.start(agentId, openPort, monitorPort);
            }
            else {
                new SignalSender().sendCommand(cmd)
            }
        }
    }

    public static getHome(home: string) {
        // Get BayServer home
        if(home == null)
            home = ".";
        this.bservHome = SysUtil.getAbsolutePath(home);
        if(!SysUtil.isDirectory(this.bservHome))
            throw new BayException("BayServer home is not a directory: %s", this.bservHome);

        if (this.bservHome.endsWith(sep))
            this.bservHome = this.bservHome.substring(0, this.bservHome.length - 1);

        BayLog.debug("BayServer home: %s", this.bservHome);
    }

    public static getPlan(plan: string) {
        // Get debug mode
        //BayLog.debug("Log level=" + BayLog.logLevel);

        // Get plan file
        if(plan == null)
            plan = "plan/bayserver.plan";
        if(!SysUtil.isAbsolutePath(plan))
            plan = this.bservHome + sep + plan;
        this.bservPlan = SysUtil.getAbsolutePath(plan)
        BayLog.info("BayServer Plan: %s", this.bservPlan);
        if(!SysUtil.isFile(this.bservPlan))
            throw new BayException("Plan file is not a file: %s", this.bservPlan);
    }

    public static getLib() {
        this.bservLib = path.join(this.bservHome, "node_modules", "bayserver")
        if(!SysUtil.isDirectory(this.bservLib))
            throw new BayException("Library directory is not a directory: %s", this.bservLib)

        BayLog.debug("BayServer lib: %s", this.bservLib)
    }

    public static init() {
        let initDir = path.join(this.bservLib, "init")
        BayLog.debug("init directory: %s", initDir)
        SysUtil.copyDir(initDir, this.bservHome)
    }

    public static start(agentId: number, openPort: boolean, monitorPort: number) {
        process.on('exit', (code) => {
            this.originalConsoleLog(`***************** Process exiting with code: ${code} *******************`);
        });

        try {
            BayMessage.init(this.bservLib + "/conf/messages", new Locale("ja", "JP"));
            BayDockers.init(this.bservLib + "/conf/dockers.bcf");
            Mimes.init(this.bservLib + "/conf/mimes.bcf");
            HttpStatus.init(this.bservLib + "/conf/httpstatus.bcf");
            this.loadPlan(this.bservPlan);

            /** Init stores, memory usage managers */
            PacketStore.init();
            InboundShipStore.init();
            ProtocolHandlerStore.init();
            TourStore.init(TourStore.MAX_TOURS);
            MemUsage.init()

            this.originalConsoleLog = console.log
            this.originalConsoleError = console.error
            let redirectFile = this.harbor.getRedirectFile()
            if (StrUtil.isSet(redirectFile)) {
                redirectFile = this.getLocation(redirectFile)
                if(BayServer.harbor.isMultiCore() && agentId > 0) {
                    let p = redirectFile.lastIndexOf('.');
                    let filePrefix, fileExt
                    if(p == -1) {
                        filePrefix = redirectFile;
                        fileExt = "";
                    }
                    else {
                        filePrefix = redirectFile.substring(0, p);
                        fileExt = redirectFile.substring(p);
                    }
                    redirectFile = filePrefix + "-" + agentId + fileExt
                }
                this.logConsole = fs.createWriteStream(redirectFile)
                this.logConsole.on('error', (err) => {
                    BayLog.error_e(err, BayMessage.get(Symbol.CFG_CANNOT_OPEN_REDIRECT_FILE, redirectFile))
                    throw new Error(BayMessage.get(Symbol.CFG_CANNOT_OPEN_REDIRECT_FILE, redirectFile))
                })
                this.logConsole.on('open', () => {
                    BayLog.debug(BayMessage.get(Symbol.MSG_REDIRECT_FILE_OPENED, redirectFile))
                    console.log = (...args: any[]) => {
                        let message = args.join(' ');
                        this.logConsole.write(message + '\n')
                    };
                    console.error = console.log
                })
            }

            if(agentId == -1) {
                this.printVersion();
                this.myHostName = hostname()
                BayLog.debug("Host name    : " + this.myHostName);
                this.parentStart()
            }
            else {
                this.childStart(agentId, openPort, monitorPort)
            }
        }
        catch (e) {
            BayLog.error_e(e);
            // Exit after 5 seconds
            setTimeout(() => {
                exit(1)
            }, 5000)
        }
    }

    private static openPorts(callback: () => void) {

        let curIndex = 0
        for (const portDkr of this.ports) {
            // Open ports
            if (portDkr.isAnchored()) {
                // Open TCP port
                BayLog.info(BayMessage.get(Symbol.MSG_OPENING_TCP_PORT, portDkr.getHost() == null ? "" : portDkr.getHost(), portDkr.getPort(), portDkr.protocol()));

                let ch = portDkr.createServer()
                let rd = new ServerRudder(ch)

                ch.on('error', (err) => {
                    BayLog.error("Server socket error: %s", err)
                })

                ch.listen(portDkr.getPort(), () => {
                    this.anchorablePortMap.set(rd, portDkr)
                    if (this.anchorablePortMap.size == this.ports.length) {
                        callback()
                    }
                })

            } else {
                throw new BayException()
            }
        }
    }

    private static parentStart() {


        if (!BayServer.harbor.isMultiCore()) {
            // Single core mode
            this.openPorts(() => {
            })

            // Single core mode
            GrandAgent.init(
                Array.from({length: BayServer.harbor.getNumGrandAgents()}, (_, index) => index + 1),
                BayServer.harbor.getMaxShips())
        }

        GrandAgentMonitor.init(this.harbor.getNumGrandAgents(), this.anchorablePortMap)
        SignalAgent.init(this.harbor.getControlPort())
        this.createPidFile(SysUtil.pid())
    }

    private static childStart(agentId: number, openPort: boolean, monitorPort: number) {
        BayLog.debug("Child process start: agt#%d open=%s monitor=%d", agentId, openPort, monitorPort)

        if(openPort) {
            BayLog.info("agt#%d open port mode", agentId)
            this.openPorts(() => {
                BayLog.debug("init child (open port)")
                this.initChildGrandAgent(agentId)
                this.connectToMonitor(agentId, monitorPort)
            })
        }
        else {
            BayLog.info("agt#%d recv socket mode", agentId)
            process.on('message', (m: string, skt: net.Server | net.Socket) => {
                if (m.startsWith('serverSocket')) {

                    let adr = skt.address()
                    let host = adr["address"]
                    let port = adr["port"]
                    var portDkr: Port = null
                    BayLog.info('agt#%d Received server Socket', agentId);

                    for (const p of this.ports) {
                        if (p.getPort() == port) {
                            portDkr = p
                            break
                        }
                    }

                    if (portDkr == null) {
                        BayLog.fatal("Cannot find port docker: " + port)
                        exit(1);
                    }
                    else {
                        BayServer.anchorablePortMap.set(new ServerRudder(skt as Server), portDkr)
                        if (BayServer.anchorablePortMap.size == this.ports.length) {
                            // All ports are opened
                            BayLog.debug("init child (inherit port)")
                            this.initChildGrandAgent(agentId)
                            this.connectToMonitor(agentId, monitorPort)
                        }
                    }
                }
            });
        }

    }

    private static initChildGrandAgent(agentId: number) {
        BayLog.debug("Init child grand agent: agt#%d", agentId)
        GrandAgent.init(
            [agentId],
            this.harbor.getMaxShips());

        let agt = GrandAgent.get(agentId)
        agt.run().then((result) => {
            if(BayServer.harbor.isMultiCore()) {
                console.log = this.originalConsoleLog
                console.error = this.originalConsoleError
            }
            this.originalConsoleLog("logcon=" + BayServer.logConsole)
            if(this.logConsole != null) {
                this.logConsole.end()
                const finishedAsync = promisify(finished)
                this.originalConsoleLog("Wait finish event")
                BayLog.info("Wait finish event")
                finishedAsync(this.logConsole).then( () => {
                    this.originalConsoleLog("Finished")
                    if(this.harbor.isMultiCore()) {
                        exit(1);
                    }
                });
            }

        })
    }

    private static connectToMonitor(agentId: number, monitorPort: number){
        //BayLog.debug("Connect to monitor: port=%d", monitorPort)
        const skt = net.createConnection({ host: "localhost", port: monitorPort }, () => {
            let rd = new SocketRudder(skt)
            //BayLog.debug("Connected to monitor: port=%d rd=%s", monitorPort, rd)
            let agt = GrandAgent.get(agentId)
            agt.addCommandReceiver(rd)
        });

        skt.on('error', err => {
            BayLog.error_e(err)
        })
    }

    static findCity(name: string): City {
        return this.cities.findCity(name);
    }

    static parsePath(location: string) {
        location = this.getLocation(location)

        if(!SysUtil.exists(location))
            throw new IOException("File not found: " + location)

        return location
    }

    static getLocation(location: string) {
        if(!SysUtil.isAbsolutePath(location))
            return this.bservHome + path.sep + location;
        else
            return location;
    }


    //////////////////////////////////////////////////////
    // private methods
    //////////////////////////////////////////////////////
    private static loadPlan(bservConf: string) {
        let p: BcfParser = new BcfParser();
        let doc: BcfDocument = p.parse(bservConf);

        for(const o of doc.contentList) {
            if(o instanceof BcfElement) {
                let dkr = BayDockers.createDocker(o as BcfElement, null);
                if(dkr.getType() == "port") {
                    BayServer.ports.push(dkr as Object as Port);
                }
                else if(dkr.getType() == "harbor") {
                    BayServer.harbor = dkr as Object as Harbor;
                }
                else if(dkr.getType() == "city") {
                    BayServer.cities.add(dkr as Object as City);
                }
            }
        }
    }


    /**
     * Print version information
     */
    private static printVersion() {

        let version: string = "Version " + this.getVersion();
        while (version.length < 28)
            version = ' ' + version;

        console.log("        ----------------------");
        console.log("       /     BayServer        \\");
        console.log("-----------------------------------------------------");
        var line = " \\";
        var i;
        for(i = 0; i < 47 - version.length; i++)
            line += " ";
        console.log(line + version + "  /");
        console.log("  \\           Copyright (C) 2000 Yokohama Baykit  /");
        console.log("   \\                     http://baykit.yokohama  /");
        console.log("    ---------------------------------------------");
    }

    public static getVersion(): string {
        return Version.VERSION;
    }

    static getSoftwareName() {
        if (this.softwareName == null)
            this.softwareName = "BayServer/" + this.getVersion();
        return this.softwareName;
    }

    private static createPidFile(pid: number) {
        fs.writeFileSync(this.getLocation(this.harbor.getPidFile()), pid.toString())
    }
}

