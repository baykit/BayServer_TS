import {Tour} from "./tour";
import {Buffer} from "buffer";

export interface ReqContentHandler {

    onReadContent(tur: Tour, buf: Buffer, start: number, len: number) : void;

    onEndContent(tur: Tour) : void;

    onAbort(tur: Tour) : boolean;
    
}

class DevNull implements ReqContentHandler{
    onAbort(tur: Tour): boolean {
        return false;
    }

    onEndContent(tur: Tour): void {
    }

    onReadContent(tur: Tour, buf: Buffer, start: number, len: number): void {
    }
}

export class ReqContentHandlerUtil {
    static readonly devNull = new DevNull();
}
