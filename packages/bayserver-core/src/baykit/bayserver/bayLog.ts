import { BayMessage } from "./bayMessage";
import { Symbol } from "./symbol";
import { StrUtil } from "./util/strUtil";
import {format} from "util";

export class BayLog {
    static readonly LOG_LEVEL_TRACE : number = 0;
    static readonly LOG_LEVEL_DEBUG : number = 1;
    static readonly LOG_LEVEL_INFO : number  = 2;
    static readonly LOG_LEVEL_WARN : number  = 3;
    static readonly LOG_LEVEL_ERROR : number  = 4;
    static readonly  LOG_LEVEL_FATAL : number  = 5;

    /** Log level */
    public static logLevel : number = BayLog.LOG_LEVEL_INFO;
    static readonly LOG_LEVEL_NAME = ["TRACE", "DEBUG", "INFO ", "WARN ", "ERROR", "FATAL"];

    public static setLogLevel(s : string) {
        if(StrUtil.eqIgnoreCase(s, "trace"))
            BayLog.logLevel = BayLog.LOG_LEVEL_TRACE;
        else if(StrUtil.eqIgnoreCase(s, "debug"))
            BayLog.logLevel = BayLog.LOG_LEVEL_DEBUG;
        else if(StrUtil.eqIgnoreCase(s, "info"))
        BayLog.logLevel = BayLog.LOG_LEVEL_INFO;
        else if(StrUtil.eqIgnoreCase(s, "warn"))
            BayLog.logLevel = BayLog.LOG_LEVEL_WARN;
        else if(StrUtil.eqIgnoreCase(s, "error"))
            BayLog.logLevel = BayLog.LOG_LEVEL_ERROR;
        else if(StrUtil.eqIgnoreCase(s, "fatal"))
            BayLog.logLevel = BayLog.LOG_LEVEL_FATAL;
        else
            BayLog.warn(BayMessage.get(Symbol.INT_UNKNOWN_LOG_LEVEL, s));
    }

    public static info(fmt: string, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_INFO, 3, null, fmt, ...args);
    }

    public static trace(fmt: string, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_TRACE, 3, null, fmt, ...args);
    }

    public static debug(fmt: string, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_DEBUG, 3, null, fmt, ...args);
    }

    public static debug_e(e: Error, fmt: string = null, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_DEBUG, 3, e, fmt, ...args);
    }

    public static warn(fmt: string, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_WARN, 3, null, fmt, ...args);
    }

    public static warn_e(e: Error, fmt: string = null, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_WARN, 3, e, fmt, ...args);
    }

    public static error(fmt: string, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_ERROR, 3, null, fmt, ...args);
    }

    public static error_e(e: Error, fmt: string = null, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_ERROR, 3, e, fmt, ...args);
    }

    public static fatal(fmt: string, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_FATAL, 3, null, fmt, ...args);
    }

    public static fatal_e(e: Error, fmt: string = null, ...args: any[]) {
        BayLog.log(BayLog.LOG_LEVEL_FATAL, 3, e, fmt, ...args);
    }

    public static log(lvl: number, stackIndex: number, e: Error, fmt: string, ...args: any[]) {
        if(lvl < BayLog.logLevel)
            return

        if(fmt != null) {
            let msg: string = ""
            try {
                if(args == null || args.length == 0)
                    msg = format("%s", fmt);
                else
                    msg = format(fmt, ...args);
            }
            catch(e) {
                console.log(e.stack)
                msg = fmt;
            }

            let stackTop: string = new Error().stack.split("\n")[stackIndex]
            let m = stackTop.match(/^(.*)\((.*)\)$/)
            if(m != null)
                stackTop = m[1] + " " + m[2]
            m = stackTop.match(/^(.*)at(.*) (.*):(.*):(.*)$/)
            var file = ""
            var line = ""
            if(m) {
                file = m[3]
                line = m[4]
            }
            let pos = "(" + file + ":" + line + ")";

            let prefix = "[" + new Date().toLocaleString() + "] " + this.LOG_LEVEL_NAME[lvl] + ". "

            console.log(prefix + msg + " " + pos);
        }

        if(e) {
            if (BayLog.isDebug() || lvl == BayLog.LOG_LEVEL_FATAL) {
                console.log(e.stack)
            }
            else {
                BayLog.log(lvl, stackIndex + 1, null, "%s", e.message)
            }
        }
    }

    static isDebug() : boolean{
        return BayLog.logLevel <= BayLog.LOG_LEVEL_DEBUG;
    }

    static isTrace() : boolean{
        return BayLog.logLevel <= BayLog.LOG_LEVEL_TRACE;
    }

}