import {Packet} from "./packet";
import {Reusable} from "../util/Reusable";
import {Postman} from "../util/postman";
import {Ship} from "../ship/ship";
import {DataConsumeListener} from "../util/dataConsumeListener";

export class PacketPacker<P extends Packet> implements Reusable {

    public reset(): void {

    }

    public post(sip: Ship, pkt: P , listener: DataConsumeListener): void {
        if(listener == null)
            throw new Error();

        let buf = Buffer.alloc(pkt.bufLen)
        pkt.buf.copy(buf, 0, 0, pkt.bufLen)

        sip.transporter.reqWrite(
            sip.rudder,
            buf,
            null,
            pkt,
            listener
        )
    }

}
