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
export class CmdStdOut extends InOutCommandBase {

    constructor(
        reqId: number,
        data: Buffer = null,
        start: number = null,
        len: number = null) {
        super(FcgType.STDOUT, reqId, data, start, len);
    }

    handle(handler: FcgCommandHandler): number {
        return handler.handleStdOut(this);
    }

}