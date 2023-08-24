import {StrUtil} from "./strUtil";

export class CharUtil {
    static readonly CR_CODE = "\r".charCodeAt(0)
    static readonly LF_CODE = "\n".charCodeAt(0)
    static readonly SP_CODE = " ".charCodeAt(0)
    static readonly CLN_CODE = ":".charCodeAt(0)
    static readonly A_CODE = "A".charCodeAt(0)
    static readonly B_CODE = "B".charCodeAt(0)
    static readonly Z_CODE = "Z".charCodeAt(0)
    static readonly a_CODE = "a".charCodeAt(0)
    static readonly CRLF_BYTES = Buffer.from("\r\n", "latin1")

    static toLowerCase(c: number) {
        if(c >= this.A_CODE && c <= this.Z_CODE)
            return (c - this.A_CODE) + this.a_CODE
        else
            return c
    }
}