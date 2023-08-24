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
export class CmdStdErr extends InOutCommandBase {

    constructor(reqId: number) {
        super(FcgType.STDERR, reqId);
    }

    handle(handler: FcgCommandHandler): number {
        return handler.handleStdErr(this);
    }

}