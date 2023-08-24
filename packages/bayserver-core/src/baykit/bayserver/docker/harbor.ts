import exp = require("constants");
import {Locale} from "../util/locale";
import {Trouble} from "./trouble";

export const FILE_SEND_METHOD_SELECT: number = 1
export const FILE_SEND_METHOD_SPIN : number = 2
export const FILE_SEND_METHOD_TAXI : number = 3


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

    /** Method to send file */
    getFileSendMethod(): number;

    /** PID file name */
    getPidFile(): string;

    /** Multi core flag */
    isMultiCore(): boolean;
}
