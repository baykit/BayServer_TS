import {Packet} from "bayserver-core/baykit/bayserver/protocol/packet";

/**
 * FCGI spec
 *   http://www.mit.edu/~yandros/doc/specs/fcgi-spec.html
 *
 * FCGI Packet (Record) format
 *         typedef struct {
 *             unsigned char version;
 *             unsigned char type;
 *             unsigned char requestIdB1;
 *             unsigned char requestIdB0;
 *             unsigned char contentLengthB1;
 *             unsigned char contentLengthB0;
 *             unsigned char paddingLength;
 *             unsigned char reserved;
 *             unsigned char contentData[contentLength];
 *             unsigned char paddingData[paddingLength];
 *         } FCGI_Record;
 */

export class FcgPacket extends Packet {

    static readonly PREAMBLE_SIZE: number = 8;

    static readonly VERSION: number = 1;
    static readonly MAXLEN: number = 65535;

    static readonly FCGI_NULL_REQUEST_ID: number = 0;

    version: number = FcgPacket.VERSION;
    reqId: number;

    constructor(type: number) {
        super(type, FcgPacket.PREAMBLE_SIZE, FcgPacket.MAXLEN);
    }

    reset() : void {
        this.version = FcgPacket.VERSION
        this.reqId = 0;
        super.reset();
    }

    toString(): string {
        return "FcgPacket(" + this.type + ")";
    }
}
