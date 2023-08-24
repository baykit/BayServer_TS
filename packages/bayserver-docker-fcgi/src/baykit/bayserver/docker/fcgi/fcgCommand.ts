import {Command} from "bayserver-core/baykit/bayserver/protocol/command";
import {FcgPacket} from "./fcgPacket";
import {FcgCommandHandler} from "./fcgCommandHandler";

export abstract class FcgCommand extends Command<FcgCommand, FcgPacket, FcgCommandHandler> {

    reqId: number;

    constructor(type: number, reqId: number) {
        super(type);
        this.reqId = reqId
    }

    unpack(pkt: FcgPacket) : void {
        this.reqId = pkt.reqId
    }

    /**
     * super class method must be called from last line of override method since header cannot be packed before data is constructed
     */
    pack(pkt: FcgPacket) : void {
        pkt.reqId = this.reqId
        this.packHeader(pkt);
    }

    packHeader(pkt: FcgPacket) : void {
        let acc = pkt.newHeaderAccessor();
        acc.putByte(pkt.version);
        acc.putByte(pkt.type);
        acc.putShort(pkt.reqId);
        acc.putShort(pkt.dataLen());
        acc.putByte(0);  // paddinglen
        acc.putByte(0); // reserved
    }
}