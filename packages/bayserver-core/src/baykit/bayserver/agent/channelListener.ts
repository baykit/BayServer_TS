import {DataConsumeListener} from "../util/dataConsumeListener";
import {ChannelWrapper} from "./channelWrapper";

export interface ChannelListener
{
    onRead(chkCh: ChannelWrapper, buf: Buffer) : number;

    onWrite(chkCh: ChannelWrapper, listener: DataConsumeListener) : number;

    onConnect(chkCh: ChannelWrapper) : number;

    onError(chkCh: ChannelWrapper, err: Error) : void;

    onClosed(chkCh: ChannelWrapper) : void;

    checkTimeout(chkCh: ChannelWrapper, durationSec: number) : boolean;

    getBuf(): Buffer;
}