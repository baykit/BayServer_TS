import {FcgCommand} from "../fcgCommand";
import {FcgPacket} from "../fcgPacket";
import {FcgCommandHandler} from "../fcgCommandHandler";

/**
 * FCGI spec
 *   http://www.mit.edu/~yandros/doc/specs/fcgi-spec.html
 *
 * StdIn/StdOut/StdErr command format
 *   raw data
 */
export abstract class InOutCommandBase extends FcgCommand {

    static readonly MAX_DATA_LEN: number = FcgPacket.MAXLEN - FcgPacket.PREAMBLE_SIZE;
    /**
     * This class refers external byte array, so this IS NOT mutable
     */
    start: number;
    length: number;
    data: Buffer;

    constructor(
        type: number,
        reqId: number,
        data: Buffer = null,
        start: number = null,
        len: number = null) {
        super(type, reqId);
        this.data = data
        this.start = start
        this.length = len
    }

    pack(pkt: FcgPacket) {
        if(this.data != null && this.data.length > 0) {
            let acc = pkt.newDataAccessor();
            acc.putBytes(this.data, this.start, this.length);
        }

        // must be called from last line
        super.pack(pkt);
    }

    unpack(pkt: FcgPacket) {
        super.unpack(pkt);
        this.start = pkt.headerLen;
        this.length = pkt.dataLen();
        this.data = pkt.buf;
    }
}