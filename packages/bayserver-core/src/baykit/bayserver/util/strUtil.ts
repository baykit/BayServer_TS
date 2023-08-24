import {CharUtil} from "./charUtil";
import {BayLog} from "../bayLog";
import {Buffer} from "buffer";
import * as string_decoder from "string_decoder";

export class StrUtil {
    static readonly falses: string[] = ["no", "false", "0", "off"];
    static readonly trues: string[] = ["yes", "true", "1", "on"];

    public static eqIgnoreCase(s1: string, s2: string) : boolean {
        return s1.toLowerCase() == s2.toLowerCase()
    }

    public static isSet(s : string) : boolean {
        return s != null && s != ""
    }

    public static empty(s : string) : boolean {
        return !this.isSet(s)
    }

    static indent(count: number): string {
        return " ".repeat(count);
    }

    /**
     * Maybe faster
     */
    static toLowerCase(str: string) {
        for(let i = 0; i < str.length; i++) {
            let c = str.charCodeAt(i);
            if(c >= CharUtil.A_CODE && c <= CharUtil.Z_CODE) {
                return str.toLowerCase();
            }
        }
        return str;
    }

    static parseBool(val: string) {
        val = val.toLowerCase();
        if(this.trues.includes(val))
            return true;
        else if(this.falses.includes(val))
            return false;
        else {
            BayLog.warn("Invalid boolean value: " + val);
            return false;
        }
    }

    static parseSize(value: string) {
        value = value.toLowerCase();
        let rate = 1;
        if(value.endsWith("b"))
            value = value.substring(0, value.length - 1);
        if(value.endsWith("k")) {
            value = value.substring(0, value.length- 1);
            rate = 1024;
        }
        else if(value.endsWith("m")) {
            value = value.substring(0, value.length - 1);
            rate = 1024 * 1024;
        }

        return Number.parseInt(value) * rate;
    }

    static parseCharset(charset: string) : string {
        return charset;
    }

    static toEncoding(encoding: string): BufferEncoding {
        switch(encoding.toLowerCase()) {
            case "iso-8859-1":
                return "ascii"
                return "utf8"
            case "utf-8":
                return "utf-8"
            case "utf-16":
                return "utf16le"
            default:
                return null
        }
    }

    static toBytes(str: string): Buffer {
        return Buffer.from(str, "latin1")
    }

    static fromBytes(bytes: Buffer, start: number = 0, len: number = bytes.length): string {
        return bytes.toString("latin1", start, len)
    }
}