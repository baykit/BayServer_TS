import {Command} from "bayserver-core/baykit/bayserver/protocol/command";
import {AjpAccessor, AjpPacket} from "./ajpPacket";
import {AjpCommandHandler} from "./ajpCommandHandler";
import {CharUtil} from "bayserver-core/baykit/bayserver/util/charUtil";

export abstract class AjpCommand extends Command<AjpCommand, AjpPacket, AjpCommandHandler> {

    toServer: boolean;

    constructor(type: number, toServer: boolean) {
        super(type);
        this.toServer = toServer;
    }

    unpack(pkt: AjpPacket) : void {
        if(pkt.type != this.type)
            throw new Error("Illegal State");
        this.toServer = pkt.toServer;
    }

    /**
     * super class method must be called from last line of override method since header cannot be packed before data is constructed
     */
    pack(pkt: AjpPacket) : void {
        if(pkt.type != this.type)
            throw new Error("Illegal Argument");
        pkt.toServer = this.toServer;
        this.packHeader(pkt);
    }

    packHeader(pkt: AjpPacket) : void {

        let acc: AjpAccessor = pkt.newAjpHeaderAccessor();
        if(pkt.toServer) {
            acc.putByte(0x12);
            acc.putByte(0x34);
        }
        else {
            acc.putByte(CharUtil.A_CODE);
            acc.putByte(CharUtil.B_CODE);
        }
        acc.putByte((pkt.dataLen() >> 8) & 0xff);
        acc.putByte(pkt.dataLen() & 0xff);
    }
}