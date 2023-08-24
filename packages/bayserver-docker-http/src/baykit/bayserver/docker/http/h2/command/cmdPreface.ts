import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";

/**
 * Preface is dummy command and packet
 *
 *   packet is not in frame format but raw data: "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"
 */
export class CmdPreface extends H2Command {

    prefaceBytes: Buffer = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
    protocol: string

    constructor(streamId: number, flags: H2Flags) {
        super(H2Type.PREFACE, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        let acc = pkt.newDataAccessor();
        let prefaceData = Buffer.alloc(24);
        acc.getBytes(prefaceData);
        this.protocol = prefaceData.toString("latin1", 6, 14);
    }

    pack(pkt: H2Packet) {
        let acc = pkt.newH2DataAccessor();
        acc.putBytes(this.prefaceBytes);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handlePreface(this);
    }

}