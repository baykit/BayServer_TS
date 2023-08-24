import {CommandHandler} from "bayserver-core/baykit/bayserver/protocol/commandHandler";
import {AjpCommand} from "./ajpCommand";
import {CmdData} from "./command/cmdData";
import {CmdEndResponse} from "./command/cmdEndResponse";
import {CmdForwardRequest} from "./command/cmdForwardRequest";
import {CmdSendBodyChunk} from "./command/cmdSendBodyChunk";
import {CmdSendHeaders} from "./command/cmdSendHeaders";
import {CmdShutdown} from "./command/cmdShutdown";
import {CmdGetBodyChunk} from "./command/cmdGetBodyChunk";

export interface AjpCommandHandler extends CommandHandler<AjpCommand>{

    handleData(cmd: CmdData): number;

    handleEndResponse(cmd: CmdEndResponse): number;

    handleForwardRequest(cmd: CmdForwardRequest): number;

    handleSendBodyChunk(cmd: CmdSendBodyChunk): number;

    handleSendHeaders(cmd: CmdSendHeaders): number;

    handleShutdown(cmd: CmdShutdown): number;

    handleGetBodyChunk(cmd: CmdGetBodyChunk): number;

    needData(): boolean;
    
}