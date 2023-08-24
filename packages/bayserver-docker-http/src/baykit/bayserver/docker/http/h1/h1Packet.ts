import {Packet} from "bayserver-core/baykit/bayserver/protocol/packet";

export class H1Packet extends Packet {

    static readonly MAX_HEADER_LEN: number = 0; // H1 packet does not have packet header
    static readonly MAX_DATA_LEN: number = 65536;

    /** space */
    static readonly SP_BYTES = " ";
    /** Line separator */
    public readonly CRLF_BYTES = "\r\n";

    constructor(type: number) {
        super(type, H1Packet.MAX_HEADER_LEN, H1Packet.MAX_DATA_LEN);
    }

    public toString(): string {
        return "H1Packet(" + this.type + ") len=" + this.dataLen();
    }
}
