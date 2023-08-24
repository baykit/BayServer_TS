import {FcgCommand} from "../fcgCommand";
import {FcgType} from "../fcgType";
import {FcgPacket} from "../fcgPacket";
import {FcgCommandHandler} from "../fcgCommandHandler";


/**
 * FCGI spec
 *   http://www.mit.edu/~yandros/doc/specs/fcgi-spec.html
 *
 * Begin request command format
 *         typedef struct {
 *             unsigned char roleB1;
 *             unsigned char roleB0;
 *             unsigned char flags;
 *             unsigned char reserved[5];
 *         } FCGI_BeginRequestBody;
 */
export class CmdBeginRequest extends FcgCommand {

    static readonly FCGI_KEEP_CONN: number = 1;

    static readonly FCGI_RESPONDER: number = 1;
    static readonly FCGI_AUTHORIZER: number = 2;
    static readonly FCGI_FILTER: number = 3;

    role: number;
    keepConn: boolean;

    constructor(reqId: number) {
        super(FcgType.BEGIN_REQUEST, reqId);
    }

    pack(pkt: FcgPacket) {
        let acc = pkt.newDataAccessor();
        acc.putShort(this.role);
        acc.putByte(this.keepConn ? 1 : 0);
        let reserved = Buffer.alloc(5);
        acc.putBytes(reserved);

        // must be called from last line
        super.pack(pkt);
    }

    unpack(pkt: FcgPacket) {
        let acc = pkt.newDataAccessor();
        super.unpack(pkt);
        this.role = acc.getShort();
        let flags = acc.getByte();
        this.keepConn = (flags & CmdBeginRequest.FCGI_KEEP_CONN) != 0;
    }

    handle(handler: FcgCommandHandler): number {
        return handler.handleBeginRequest(this);
    }

}