import {DockerBase} from "../base/dockerBase";
import {Log} from "../log";
import {Tour} from "../../tour/tour";
import {LifeCycleListener} from "../../agent/lifeCycleListener";
import {LogBoat} from "./logBoat";
import {BayLog} from "../../bayLog";
import * as fs from "fs";
import {PlainTransporter} from "../../agent/transporter/plainTransporter";
import {GrandAgent} from "../../agent/grandAgent";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {LogItem} from "./logItem";
import * as os from "os";
import {
    ConnectionStatusItem, IntervalItem, MethodItem,
    NullItem, PortItem,
    ProtocolItem, QueryStringItem,
    RemoteHostItem, RemoteLogItem, RemoteUserItem,
    RequestBytesItem1, RequestBytesItem2,
    RequestHeaderItem, RequestUrlItem, ResponseHeaderItem,
    ServerIpItem, ServerNameItem, StartLineItem, StatusItem, TextItem, TimeItem
} from "./logItems";
import {Docker} from "../docker";
import {BcfElement} from "../../bcf/bcfElement";
import {ConfigException} from "../../configException";
import {SysUtil} from "../../util/sysUtil";
import {BayServer} from "../../bayserver";
import * as path from "path";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {LogItemFactory} from "./logItemFactory";
import {ChannelWrapper} from "../../agent/channelWrapper";

class AgentListener implements LifeCycleListener {

    docker: BuiltInLogDocker

    constructor(dkr: BuiltInLogDocker) {
        this.docker = dkr
    }


    add(agtId: number) {
        let fileName = this.docker.filePrefix + "_" + agtId + "." + this.docker.fileExt;
        let boat = new LogBoat();

        fs.open(fileName, "a", (err, fd) => {
            if (err) {
                BayLog.error_e(err, "Cannot open file: %s", fileName)
                return;
            }

            BayLog.debug("Log file opened: %s fd=%d", fileName, fd);

            let tp
            if(this.docker.logWriteMethod == BuiltInLogDocker.LOG_WRITE_METHOD_SELECT) {
                tp = new PlainTransporter(false, 0, true) // write only
                tp.init(GrandAgent.get(agtId).nonBlockingHandler, new ChannelWrapper(fd), boat)
            }
            else {
                throw new Error("Log Write method not supported");
            }

            try {
                boat.initBoat(fileName, tp);
            }
            catch(e) {
                BayLog.fatal(BayMessage.get(Symbol.INT_CANNOT_OPEN_LOG_FILE, fileName));
                BayLog.fatal_e(e);
            }
        })

        this.docker.loggers.set(agtId, boat);
    }

    remove(agtId: number) {
        this.docker.loggers.delete(agtId)
    }

}


export class BuiltInLogDocker extends DockerBase implements Log {

    static readonly LOG_WRITE_METHOD_SELECT: number = 1;
    static readonly LOG_WRITE_METHOD_SPIN: number = 2;
    static readonly LOG_WRITE_METHOD_TAXI: number = 3;
    static readonly DEFAULT_LOG_WRITE_METHOD: number = BuiltInLogDocker.LOG_WRITE_METHOD_SELECT;

    /** Mapping table for format */
    static map: Map<string, LogItemFactory>

    /** Log file name parts */
    filePrefix: string;
    fileExt: string;

    /**
     *  Logger for each agent.
     *  Map of Agent ID => LogBoat
     */
    loggers: Map<number, LogBoat>

    /** Log format */
    format: string;

    /** Log items */
    logItems: LogItem[] = []

    /** Log write method */
    logWriteMethod: number = BuiltInLogDocker.DEFAULT_LOG_WRITE_METHOD;

    static lineSep: string = os.EOL;

    constructor() {
        super();
        this.loggers = new Map()
    }

    ////////////////////////////////////////
    // Implements DockerBase
    ////////////////////////////////////////
    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);
        let p = elm.arg.lastIndexOf('.');
        if(p == -1) {
            this.filePrefix = elm.arg;
            this.fileExt = "";
        }
        else {
            this.filePrefix = elm.arg.substring(0, p);
            this.fileExt = elm.arg.substring(p + 1);
        }

        if(this.format == null) {
            throw new ConfigException(
                elm.fileName,
                elm.lineNo,
                BayMessage.get(
                    Symbol.CFG_INVALID_LOG_FORMAT,
                    ""));
        }

        if(!SysUtil.isAbsolutePath(this.filePrefix))
            this.filePrefix = SysUtil.joinPath(BayServer.bservHome, this.filePrefix);

        let logDir = path.dirname(this.filePrefix)
        if(!SysUtil.isDirectory(logDir))
            fs.mkdir(logDir, err => {
                BayLog.fatal_e(err, "Cannot create log directory: %s", logDir)
            });

        // Parse format
        this.compile(this.format, this.logItems, elm.fileName, elm.lineNo)

        GrandAgent.addLifecycleListener(new AgentListener(this));
    }


    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return false;

            case "format":
                this.format = kv.value;
                break;

            case "logwritemethod":
                switch(kv.value.toLowerCase()) {
                    case "select":
                        this.logWriteMethod = BuiltInLogDocker.LOG_WRITE_METHOD_SELECT;
                        break;
                    case "spin":
                        this.logWriteMethod = BuiltInLogDocker.LOG_WRITE_METHOD_SPIN;
                        break;
                    case "taxi":
                        this.logWriteMethod = BuiltInLogDocker.LOG_WRITE_METHOD_TAXI;
                        break;
                    default:
                        throw new ConfigException(kv.fileName, kv.lineNo, BayMessage.get(Symbol.CFG_INVALID_PARAMETER_VALUE, kv.value));
                }
        }
        return true
    }

    ////////////////////////////////////////
    // Implements Log
    ////////////////////////////////////////
    log(tour: Tour) {
        let sb: string = ""
        for (const logItem of this.logItems) {
            let item = logItem.getItem(tour);
            if (item == null)
                sb += "-";
            else
                sb += item
        }

        // If threre are message to write, write it
        if (sb.length > 0) {
            try {
                this.getLogger(tour.ship.agent).log(sb.toString());
            }
            catch(e) {
                BayLog.error_e(e, "%s Error on logging: %s", tour, e.message)
            }
        }
    }

    ////////////////////////////////////////
    // private methods
    ////////////////////////////////////////
    /**
     * Compile format pattern
     */
    compile(str: string, items: LogItem[], fileName: string, lineNo: number) {
        // Find control code
        let pos = str.indexOf('%');
        if (pos != -1) {
            let text = str.substring(0, pos);
            items.push(new TextItem(text));
            this.compileCtl(str.substring(pos + 1), items, fileName, lineNo);
        } else {
            items.push(new TextItem(str));
        }
    }

    /**
     * Compile format pattern(Control code)
     */
    compileCtl(str: string, items: LogItem[], fileName: string, lineNo: number) {
        let param = null;

        // if exists param
        if (str.charAt(0) == '{') {
            // find close bracket
            let pos = str.indexOf('}');
            if (pos == -1) {
                throw new ConfigException(fileName, lineNo, BayMessage.get(Symbol.CFG_INVALID_LOG_FORMAT, this.format));
            }
            param = str.substring(1, pos);
            str = str.substring(pos + 1);
        }

        let ctlChar = "";
        let error = false;

        if (str.length == 0)
            error = true;

        if (!error) {
            // get control char
            ctlChar = str.substring(0, 1);
            str = str.substring(1);

            if (ctlChar == ">") {
                if (str.length == 0) {
                    error = true;
                } else {
                    ctlChar = str.substring(0, 1);
                    str = str.substring(1);
                }
            }
        }

        let fct: LogItemFactory = null;
        if (!error) {
            fct = BuiltInLogDocker.map.get(ctlChar);
            if (fct == null)
                error = true;
        }

        if (error) {
            throw new ConfigException(
                fileName,
                lineNo,
                BayMessage.get(Symbol.CFG_INVALID_LOG_FORMAT, this.format + " (unknown control code: '%" + ctlChar + "')"));
        }

        let item = fct();
        item.init(param);
        items.push(item);
        this.compile(str, items, fileName, lineNo);
    }

    getLogger(agt: GrandAgent): LogBoat {
        return this.loggers.get(agt.agentId)
    }

    ////////////////////////////////////////
    // Implements Log
    ////////////////////////////////////////
    static initClass()
    {
        this.map = new Map()
        // Create mapping table
        this.map.set("a", RemoteHostItem.factory);
        this.map.set("A", ServerIpItem.factory);
        this.map.set("b", RequestBytesItem1.factory);
        this.map.set("B", RequestBytesItem2.factory);
        this.map.set("c", ConnectionStatusItem.factory);
        this.map.set("e", NullItem.factory);
        this.map.set("h", RemoteHostItem.factory);
        this.map.set("H", ProtocolItem.factory);
        this.map.set("i", RequestHeaderItem.factory);
        this.map.set("l", RemoteLogItem.factory);
        this.map.set("m", MethodItem.factory);
        this.map.set("n", NullItem.factory);
        this.map.set("o", ResponseHeaderItem.factory);
        this.map.set("p", PortItem.factory);
        this.map.set("P", NullItem.factory);
        this.map.set("q", QueryStringItem.factory);
        this.map.set("r", StartLineItem.factory);
        this.map.set("s", StatusItem.factory);
        this.map.set(">s", StatusItem.factory);
        this.map.set("t", TimeItem.factory);
        this.map.set("T", IntervalItem.factory);
        this.map.set("u", RemoteUserItem.factory);
        this.map.set("U", RequestUrlItem.factory);
        this.map.set("v", ServerNameItem.factory);
        this.map.set("V", NullItem.factory);
    }
}

BuiltInLogDocker.initClass()

module.exports = {
    createDocker: (): Docker => new BuiltInLogDocker()
}