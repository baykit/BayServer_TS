import {FcgCommand} from "../fcgCommand";
import {FcgType} from "../fcgType";
import {FcgCommandHandler} from "../fcgCommandHandler";
import {InOutCommandBase} from "./inOutCommandBase";


/**
 * FCGI spec
 *   http://www.mit.edu/~yandros/doc/specs/fcgi-spec.html
 *
 * StdErr command format
 *   raw data
 */
export class CmdStdIn extends InOutCommandBase {

    constructor(
        reqId: number,
        data: Buffer = null,
        start: number = null,
        len: number = null) {
        super(FcgType.STDIN, reqId, data, start, len);
    }

    handle(handler: FcgCommandHandler): number {
        return handler.handleStdIn(this);
    }

}