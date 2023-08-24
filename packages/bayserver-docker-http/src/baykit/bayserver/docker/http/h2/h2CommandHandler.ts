import {CommandHandler} from "bayserver-core/baykit/bayserver/protocol/commandHandler";
import {H2Command} from "./h2Command";
import {CmdPreface} from "./command/cmdPreface";
import {CmdData} from "./command/cmdData";
import {CmdHeaders} from "./command/cmdHeaders";
import {CmdPriority} from "./command/cmdPriority";
import {CmdSettings} from "./command/cmdSettings";
import {CmdWindowUpdate} from "./command/cmdWindowUpdate";
import {CmdGoAway} from "./command/cmdGoAway";
import {CmdPing} from "./command/cmdPing";
import {CmdRstStream} from "./command/cmdRstStream";

export interface H2CommandHandler extends CommandHandler<H2Command>{

    handlePreface(cmd: CmdPreface): number;

    handleData(cmd: CmdData): number;

    handleHeaders(cmd: CmdHeaders): number;

    handlePriority(cmd: CmdPriority): number;

    handleSettings(cmd: CmdSettings): number;

    handleWindowUpdate(cmd: CmdWindowUpdate): number;

    handleGoAway(cmd: CmdGoAway): number;

    handlePing(cmd: CmdPing): number;

    handleRstStream(cmd: CmdRstStream): number;
    
}