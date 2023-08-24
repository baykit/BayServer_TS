import {AjpCommand} from "../ajpCommand";
import {AjpType} from "../ajpType";
import {AjpCommandHandler} from "../ajpCommandHandler";

/**
 * Shutdown command format
 *
 *   none
 */
export class CmdShutdown extends AjpCommand {

    constructor() {
        super(AjpType.SHUTDOWN, true);
    }

    handle(handler: AjpCommandHandler): number {
        return handler.handleShutdown(this);
    }

}