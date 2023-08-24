import {FcgCommand} from "../fcgCommand";
import {FcgType} from "../fcgType";
import {FcgPacket} from "../fcgPacket";
import {FcgCommandHandler} from "../fcgCommandHandler";

/**
 * FCGI spec
 *   http://www.mit.edu/~yandros/doc/specs/fcgi-spec.html
 *
 * Endrequest command format
 *         typedef struct {
 *             unsigned char appStatusB3;
 *             unsigned char appStatusB2;
 *             unsigned char appStatusB1;
 *             unsigned char appStatusB0;
 *             unsigned char protocolStatus;
 *             unsigned char reserved[3];
 *         } FCGI_EndRequestBody;
 */
export class CmdEndRequest extends FcgCommand {

    static readonly FCGI_REQUEST_COMPLETE: number = 0;
    static readonly FCGI_CANT_MPX_CONN: number = 1;
    static readonly FCGI_OVERLOADED: number = 2;
    static readonly FCGI_UNKNOWN_ROLE: number = 3;

    appStatus: number;
    protocolStatus: number = CmdEndRequest.FCGI_REQUEST_COMPLETE;

    constructor(reqId: number) {
        super(FcgType.END_REQUEST, reqId);
    }

    pack(pkt: FcgPacket) {
        let acc = pkt.newDataAccessor();
        acc.putInt(this.appStatus);
        acc.putByte(this.protocolStatus);
        let reserved = Buffer.alloc(3);
        acc.putBytes(reserved);

        // must be called from last line
        super.pack(pkt);
    }

    unpack(pkt: FcgPacket) {
        super.unpack(pkt);
        let acc = pkt.newDataAccessor();
        this.appStatus = acc.getInt();
        this.protocolStatus = acc.getByte();
    }

    handle(handler: FcgCommandHandler): number {
        return handler.handleEndRequest(this);
    }

}