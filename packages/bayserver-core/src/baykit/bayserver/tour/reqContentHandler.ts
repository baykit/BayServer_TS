import {Tour} from "./tour";
import {Buffer} from "buffer";
import {ContentConsumeListener} from "./contentConsumeListener";

export interface ReqContentHandler {

    onReadReqContent(tur: Tour, buf: Buffer, start: number, len: number, lis: ContentConsumeListener) : void;

    onEndReqContent(tur: Tour) : void;

    onAbortReq(tur: Tour) : boolean;
    
}

class DevNull implements ReqContentHandler{
    onAbortReq(tur: Tour): boolean {
        return false;
    }

    onEndReqContent(tur: Tour): void {
    }

    onReadReqContent(tur: Tour, buf: Buffer, start: number, len: number): void {
    }
}

export class ReqContentHandlerUtil {
    static readonly devNull = new DevNull();
}
