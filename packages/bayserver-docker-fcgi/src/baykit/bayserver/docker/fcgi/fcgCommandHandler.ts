import {CommandHandler} from "bayserver-core/baykit/bayserver/protocol/commandHandler";
import {FcgCommand} from "./fcgCommand";
import {CmdBeginRequest} from "./command/cmdBeginRequest";
import {CmdParams} from "./command/cmdParams";
import {CmdEndRequest} from "./command/cmdEndRequest";
import {CmdStdErr} from "./command/cmdStdErr";
import {CmdStdIn} from "./command/cmdStdIn";
import {CmdStdOut} from "./command/cmdStdOut";


export interface FcgCommandHandler extends CommandHandler<FcgCommand>{

    handleBeginRequest(cmd: CmdBeginRequest): number;

    handleEndRequest(cmd: CmdEndRequest): number;

    handleParams(cmd: CmdParams): number;

    handleStdErr(cmd: CmdStdErr): number;

    handleStdIn(cmd: CmdStdIn): number;

    handleStdOut(cmd: CmdStdOut): number;

}