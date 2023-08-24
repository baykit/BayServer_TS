import {CommandHandler} from "bayserver-core/baykit/bayserver/protocol/commandHandler";
import {H1Command} from "./h1Command";
import {CmdHeader} from "./command/cmdHeader";
import {CmdContent} from "./command/cmdContent";
import {CmdEndContent} from "./command/cmdEndContent";

export interface H1CommandHandler extends CommandHandler<H1Command> {

    handleHeader(cmd: CmdHeader) : number;

    handleContent(cmd: CmdContent) : number;

    handleEndContent(cmdEndContent: CmdEndContent) : number;

    reqFinished() : boolean;
}