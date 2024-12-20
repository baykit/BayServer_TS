import {
    getMultiplexerType, getMultiplexerTypeName, getRecipientType,
    Harbor,
    MULTIPLEXER_TYPE_PIGEON,
    MULTIPLEXER_TYPE_VALVE,
    MultiplexerType, RECIPIENT_TYPE_EVENT, RECIPIENT_TYPE_PIPE,
    RecipientType
} from "../harbor";
import {DockerBase} from "../base/dockerBase";
import {Locale} from "../../util/locale";
import {Trouble} from "../trouble";
import {BcfElement} from "../../bcf/bcfElement";
import {Docker} from "../docker";
import {BayLog} from "../../bayLog";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {StrUtil} from "../../util/strUtil";
import {BayServer} from "../../bayserver";
import {ConfigException} from "../../configException";
import {Groups} from "../../util/groups";

export class BuiltInHarborDocker extends DockerBase implements Harbor {

    static readonly DEFAULT_MAX_SHIPS: number = 256;
    static readonly DEFAULT_GRAND_AGENTS: number = 0;
    static readonly DEFAULT_TRAIN_RUNNERS: number = 8;
    static readonly DEFAULT_TAXI_RUNNERS: number = 8;
    static readonly DEFAULT_SOCKET_TIMEOUT_SEC: number = 300;
    static readonly DEFAULT_KEEP_TIMEOUT_SEC: number = 20;
    static readonly DEFAULT_TOUR_BUFFER_SIZE: number = 1024 * 1024;  // 1M
    static readonly DEFAULT_CHARSET: string = "UTF-8";
    static readonly DEFAULT_CONTROL_PORT: number = -1;
    static readonly DEFAULT_NET_MULTIPLEXER: number = MULTIPLEXER_TYPE_VALVE;
    static readonly DEFAULT_FILE_MULTIPLEXER: number = MULTIPLEXER_TYPE_PIGEON;
    static readonly DEFAULT_LOG_MULTIPLEXER: number = MULTIPLEXER_TYPE_PIGEON;
    static readonly DEFAULT_CGI_MULTIPLEXER: number = MULTIPLEXER_TYPE_VALVE;
    static readonly DEFAULT_RECIPIENT: number = RECIPIENT_TYPE_EVENT;

    static readonly DEFAULT_MULTI_CORE: boolean = true;
    static readonly DEFAULT_GZIP_COMP: boolean = false;
    static readonly DEFAULT_PID_FILE: string = "bayserver.pid";

    charset: string = BuiltInHarborDocker.DEFAULT_CHARSET;
    controlPort: number = BuiltInHarborDocker.DEFAULT_CONTROL_PORT;
    netMultiplexer: MultiplexerType = BuiltInHarborDocker.DEFAULT_NET_MULTIPLEXER
    fileMultiplexer: MultiplexerType = BuiltInHarborDocker.DEFAULT_FILE_MULTIPLEXER
    logMultiplexer: MultiplexerType = BuiltInHarborDocker.DEFAULT_LOG_MULTIPLEXER
    cgiMultiplexer: MultiplexerType = BuiltInHarborDocker.DEFAULT_CGI_MULTIPLEXER
    recipient: RecipientType = BuiltInHarborDocker.DEFAULT_RECIPIENT
    gzipComp: boolean = BuiltInHarborDocker.DEFAULT_GZIP_COMP;
    keepTimeoutSec: number = BuiltInHarborDocker.DEFAULT_KEEP_TIMEOUT_SEC;
    locale: Locale;
    maxShips: number = BuiltInHarborDocker.DEFAULT_MAX_SHIPS;
    multiCore: boolean = BuiltInHarborDocker.DEFAULT_MULTI_CORE;
    numGrandAgents: number = BuiltInHarborDocker.DEFAULT_GRAND_AGENTS;
    numTainRunners: number = BuiltInHarborDocker.DEFAULT_TRAIN_RUNNERS;
    numTaxiRunners: number = BuiltInHarborDocker.DEFAULT_TAXI_RUNNERS;
    pidFile: string = BuiltInHarborDocker.DEFAULT_PID_FILE;
    redirectFile: string = null;
    socketTimeoutSec: number = BuiltInHarborDocker.DEFAULT_SOCKET_TIMEOUT_SEC;
    tourBufferSize: number = BuiltInHarborDocker.DEFAULT_TOUR_BUFFER_SIZE;
    traceHeader: boolean = false;
    trouble: Trouble;

    init(ini: BcfElement, parent: Docker) {
        super.init(ini, parent);

        if (this.numGrandAgents <= 0)
            this.numGrandAgents = 4;
        if (this.numTainRunners <= 0)
            this.numTainRunners = 1;
        if (this.maxShips <= 0)
            this.maxShips = BuiltInHarborDocker.DEFAULT_MAX_SHIPS;

        if (this.maxShips < BuiltInHarborDocker.DEFAULT_MAX_SHIPS) {
            this.maxShips = BuiltInHarborDocker.DEFAULT_MAX_SHIPS;
            BayLog.warn(BayMessage.get(Symbol.CFG_MAX_SHIPS_IS_TO_SMALL, this.maxShips));
        }

        if (!this.multiCore) {
            BayLog.warn(BayMessage.get(Symbol.CFG_SINGLE_CORE_NOT_SUPPORTED));
            this.multiCore = true
        }

        if (this.netMultiplexer != MULTIPLEXER_TYPE_VALVE) {
            BayLog.warn(
                BayMessage.get(
                    Symbol.CFG_NET_MULTIPLEXER_NOT_SUPPORTED,
                    getMultiplexerTypeName(this.netMultiplexer),
                    getMultiplexerTypeName(BuiltInHarborDocker.DEFAULT_NET_MULTIPLEXER)));
            this.netMultiplexer = BuiltInHarborDocker.DEFAULT_NET_MULTIPLEXER;
        }

        if (this.fileMultiplexer != MULTIPLEXER_TYPE_PIGEON) {
            BayLog.warn(
                BayMessage.get(
                    Symbol.CFG_FILE_MULTIPLEXER_NOT_SUPPORTED,
                    getMultiplexerTypeName(this.fileMultiplexer),
                    getMultiplexerTypeName(BuiltInHarborDocker.DEFAULT_FILE_MULTIPLEXER)));
            this.fileMultiplexer = BuiltInHarborDocker.DEFAULT_FILE_MULTIPLEXER;
        }

        if (this.logMultiplexer != MULTIPLEXER_TYPE_PIGEON) {
            BayLog.warn(
                BayMessage.get(
                    Symbol.CFG_LOG_MULTIPLEXER_NOT_SUPPORTED,
                    getMultiplexerTypeName(this.logMultiplexer),
                    getMultiplexerTypeName(BuiltInHarborDocker.DEFAULT_LOG_MULTIPLEXER)));
            this.logMultiplexer = BuiltInHarborDocker.DEFAULT_LOG_MULTIPLEXER;
        }

        if (this.cgiMultiplexer != MULTIPLEXER_TYPE_VALVE) {
            BayLog.warn(
                BayMessage.get(
                    Symbol.CFG_CGI_MULTIPLEXER_NOT_SUPPORTED,
                    getMultiplexerTypeName(this.cgiMultiplexer),
                    getMultiplexerTypeName(BuiltInHarborDocker.DEFAULT_CGI_MULTIPLEXER)))
            this.cgiMultiplexer = BuiltInHarborDocker.DEFAULT_CGI_MULTIPLEXER
        }
    }


    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////
    initDocker(dkr: Docker) : boolean {
        switch (dkr.getType()) {
            case "trouble":
                this.trouble = dkr as Object as Trouble;
                break
            default:
                return super.initDocker(dkr);
        }
    }

    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return false;

            case "loglevel":
                BayLog.setLogLevel(kv.value);
                break;

            case "charset":
                let charset = StrUtil.parseCharset(kv.value);
                if(StrUtil.isSet(charset))
                    this.charset = charset;
                break;

            /*
        case "locale":
            this.locale = LocaleUtil.parseLocale(kv.value);
            break;

             */

            case "groups": {
                let fname: string;
                try {
                    fname = BayServer.parsePath(kv.value);
                }
                catch(e) {
                    BayLog.error_e(e)
                    throw new ConfigException(kv.fileName, kv.lineNo, BayMessage.get(Symbol.CFG_FILE_NOT_FOUND, kv.value));
                }
                Groups.init(fname);
                break;
            }

            case "grandagents":
                this.numGrandAgents = Number.parseInt(kv.value);
                break;

            case "trains":
                this.numTainRunners = Number.parseInt(kv.value);
                break;

            case "taxis":
                case "taxies":
                this.numTaxiRunners = Number.parseInt(kv.value);
                break;

            case "maxships":
                this.maxShips =Number.parseInt(kv.value);
                break;

            case "timeout":
                this.socketTimeoutSec = Number.parseInt(kv.value);
                break;

            case "keeptimeout":
                this.keepTimeoutSec = Number.parseInt(kv.value);
                break;

            case "tourbuffersize":
                this.tourBufferSize = StrUtil.parseSize(kv.value);
                break;

            case "traceheader":
                this.traceHeader = StrUtil.parseBool(kv.value);
                break;

            case "redirectfile":
                this.redirectFile = kv.value;
                break;

            case "controlport":
                this.controlPort = Number.parseInt(kv.value);
                break;

            case "multicore":
                this.multiCore = StrUtil.parseBool(kv.value);
                break;

            case "gzipcomp":
                this.gzipComp = StrUtil.parseBool(kv.value);
                break;

            case "netmultiplexer":
                try {
                    this.netMultiplexer = getMultiplexerType(kv.value.toLowerCase())
                }
                catch(e) {
                    BayLog.error_e(e)
                    throw new ConfigException(kv.fileName, kv.lineNo, BayMessage.get(Symbol.CFG_INVALID_PARAMETER_VALUE, kv.value))
                }
                break;

            case "filemultiplexer":
                try {
                    this.fileMultiplexer = getMultiplexerType(kv.value.toLowerCase())
                }
                catch(e) {
                    BayLog.error_e(e)
                    throw new ConfigException(kv.fileName, kv.lineNo, BayMessage.get(Symbol.CFG_INVALID_PARAMETER_VALUE, kv.value))
                }
                break;

            case "logmultiplexer":
                try {
                    this.logMultiplexer = getMultiplexerType(kv.value.toLowerCase())
                }
                catch(e) {
                    BayLog.error_e(e)
                    throw new ConfigException(kv.fileName, kv.lineNo, BayMessage.get(Symbol.CFG_INVALID_PARAMETER_VALUE, kv.value))
                }
                break;

            case "cgimultiplexer":
                try {
                    this.cgiMultiplexer = getMultiplexerType(kv.value.toLowerCase())
                }
                catch(e) {
                    BayLog.error_e(e)
                    throw new ConfigException(kv.fileName, kv.lineNo, BayMessage.get(Symbol.CFG_INVALID_PARAMETER_VALUE, kv.value))
                }
                break;

            case "recipient":
                try {
                    this.recipient = getRecipientType(kv.value.toLowerCase())
                }
                catch(e) {
                    BayLog.error_e(e)
                    throw new ConfigException(kv.fileName, kv.lineNo, BayMessage.get(Symbol.CFG_INVALID_PARAMETER_VALUE, kv.value))
                }
                break;

            case "pidfile":
                this.pidFile = kv.value;
                break;
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements Harbor
    //////////////////////////////////////////////////////

    getType(): string {
        return "harbor";
    }

    getCharset(): string {
        return this.charset;
    }

    getControlPort(): number {
        return this.controlPort;
    }

    /** Multiplexer of Network I/O */
    getNetMultiplexer(): MultiplexerType {
        return this.netMultiplexer
    }

    /** Multiplexer of File I/O */
    getFileMultiplexer(): MultiplexerType {
        return this.fileMultiplexer
    }

    /** Multiplexer of Log output */
    getLogMultiplexer(): MultiplexerType {
        return this.logMultiplexer
    }

    /** Multiplexer of CGI input */
    getCgiMultiplexer(): MultiplexerType {
        return this.cgiMultiplexer
    }

    /** Recipient */
    getRecipient(): RecipientType {
        return this.recipient
    }

    getGzipComp(): boolean {
        return this.gzipComp;
    }

    getKeepTimeoutSec(): number {
        return this.keepTimeoutSec;
    }

    getLocale(): Locale {
        return this.locale;
    }

    getMaxShips(): number {
        return this.maxShips;
    }

    isMultiCore(): boolean {
        return this.multiCore;
    }

    getNumGrandAgents(): number {
        return this.numGrandAgents;
    }

    getNumTainRunners(): number {
        return this.numTainRunners;
    }

    getNumTaxiRunners(): number {
        return this.numTaxiRunners;
    }

    getPidFile(): string {
        return this.pidFile
    }

    getRedirectFile(): string {
        return this.redirectFile;
    }

    getSocketTimeoutSec(): number {
        return this.socketTimeoutSec;
    }

    getTourBufferSize(): number {
        return this.tourBufferSize;
    }

    isTraceHeader(): boolean {
        return this.traceHeader;
    }

    getTrouble(): Trouble {
        return this.trouble;
    }
}

module.exports = {
    createDocker: (): Docker => new BuiltInHarborDocker()
}