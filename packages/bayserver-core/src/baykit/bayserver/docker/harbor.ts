import {Locale} from "../util/locale";
import {Trouble} from "./trouble";
import {Sink} from "../sink";

export const MULTIPLEXER_TYPE_SPIDER: number = 1
export const MULTIPLEXER_TYPE_SPIN : number = 2
export const MULTIPLEXER_TYPE_PIGEON : number = 3
export const MULTIPLEXER_TYPE_JOB : number = 4
export const MULTIPLEXER_TYPE_TAXI : number = 5
export const MULTIPLEXER_TYPE_TRAIN : number = 6
export const MULTIPLEXER_TYPE_VALVE : number = 7
export type MultiplexerType = number

export const RECIPIENT_TYPE_SPIDER : number = 1
export const RECIPIENT_TYPE_PIPE : number = 2
export const RECIPIENT_TYPE_EVENT : number = 3
export type RecipientType = number



export interface Harbor {

    /** Default charset */
    getCharset(): string;

    /** Default locale */
    getLocale(): Locale;

    /** Number of grand agents */
    getNumGrandAgents(): number;

    /** Number of train runners */
    getNumTainRunners(): number;

    /** Number of taxi runners */
    getNumTaxiRunners(): number;

    /** Max count of ships */
    getMaxShips(): number;

    /** Trouble docker */
    getTrouble(): Trouble;

    /** Socket timeout in seconds */
    getSocketTimeoutSec(): number;

    /** Keep-Alive timeout in seconds */
    getKeepTimeoutSec(): number;

    /** Trace req/res header flag */
    isTraceHeader(): boolean;

    /** Internal buffer size of Tour */
    getTourBufferSize(): number;

    /** File name to redirect stdout/stderr */
    getRedirectFile(): string;

    /** Port number of signal agent */
    getControlPort(): number;

    /** Gzip compression flag */
    getGzipComp(): boolean;

    /** Multiplexer of Network I/O */
    getNetMultiplexer(): MultiplexerType

    /** Multiplexer of File I/O */
    getFileMultiplexer(): MultiplexerType

    /** Multiplexer of Log output */
    getLogMultiplexer(): MultiplexerType

    /** Multiplexer of CGI input */
    getCgiMultiplexer(): MultiplexerType

    /** Recipient */
    getRecipient(): RecipientType

    /** PID file name */
    getPidFile(): string;

    /** Multi core flag */
    isMultiCore(): boolean;
}

export function getMultiplexerTypeName(type: MultiplexerType) : String {
    switch (type) {
    case MULTIPLEXER_TYPE_SPIDER:
            return "spider";
    case MULTIPLEXER_TYPE_SPIN:
            return "spin";
    case MULTIPLEXER_TYPE_PIGEON:
            return "pigeon";
    case MULTIPLEXER_TYPE_JOB:
            return "job";
    case MULTIPLEXER_TYPE_TAXI:
            return "taxi";
    case MULTIPLEXER_TYPE_TRAIN:
            return "train";
    case MULTIPLEXER_TYPE_VALVE:
            return "valve";
    default:
        return null;
    }
}

export function getMultiplexerType(type: String): MultiplexerType {
    if(type != null)
        type = type.toLowerCase();
    switch (type) {
        case "spider":
            return MULTIPLEXER_TYPE_SPIDER;
        case "spin":
            return MULTIPLEXER_TYPE_SPIN;
        case "pigeon":
            return MULTIPLEXER_TYPE_PIGEON;
        case "job":
            return MULTIPLEXER_TYPE_JOB;
        case "taxi":
            return MULTIPLEXER_TYPE_TAXI;
        case "train":
            return MULTIPLEXER_TYPE_TRAIN;
        case "valve":
            return MULTIPLEXER_TYPE_VALVE;
        default:
            throw new Sink();
    }
}

export function getRecipientTypeName(type: RecipientType): String {
    switch (type) {
        case RECIPIENT_TYPE_SPIDER:
            return "spider";

        case RECIPIENT_TYPE_PIPE:
            return "pipe";

        case RECIPIENT_TYPE_EVENT:
            return "event";

        default:
            return null;
    }
}

export function getRecipientType(type: String): RecipientType {
    if(type != null)
        type = type.toLowerCase();
    switch (type) {
        case "spider":
            return RECIPIENT_TYPE_SPIDER;
        case "pipe":
            return RECIPIENT_TYPE_PIPE;
        case "event":
            return RECIPIENT_TYPE_EVENT;
        default:
            throw new Sink();
    }
}


