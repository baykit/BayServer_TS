import {Packet} from "./packet";
import {Reusable} from "../util/Reusable";
import {Postman} from "../util/postman";

export class PacketPacker<P extends Packet> implements Reusable {

    public reset(): void {

    }

    public post(pm: Postman, pkt: P , listener: () => void): void {
        if(listener == null)
            throw new Error();

        let buf = Buffer.alloc(pkt.bufLen)
        pkt.buf.copy(buf, 0, 0, pkt.bufLen)

        pm.post(buf, null, pkt, listener)
    }

    public flush(pm: Postman): void {
        pm.flush();
    }

    public end(pm: Postman): void {
        pm.postEnd();
    }
}
