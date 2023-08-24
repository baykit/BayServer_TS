import {FcgCommand} from "../fcgCommand";
import {FcgType} from "../fcgType";
import {FcgPacket} from "../fcgPacket";
import {FcgCommandHandler} from "../fcgCommandHandler";
import {PacketPartAccessor} from "bayserver-core/baykit/bayserver/protocol/packetPartAccessor";
import {Packet} from "bayserver-core/baykit/bayserver/protocol/packet";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";

/**
 * FCGI spec
 *   http://www.mit.edu/~yandros/doc/specs/fcgi-spec.html
 *
 *
 * Params command format (Name-Value list)
 *
 *         typedef struct {
 *             unsigned char nameLengthB0;  // nameLengthB0  >> 7 == 0
 *             unsigned char valueLengthB0; // valueLengthB0 >> 7 == 0
 *             unsigned char nameData[nameLength];
 *             unsigned char valueData[valueLength];
 *         } FCGI_NameValuePair11;
 *
 *         typedef struct {
 *             unsigned char nameLengthB0;  // nameLengthB0  >> 7 == 0
 *             unsigned char valueLengthB3; // valueLengthB3 >> 7 == 1
 *             unsigned char valueLengthB2;
 *             unsigned char valueLengthB1;
 *             unsigned char valueLengthB0;
 *             unsigned char nameData[nameLength];
 *             unsigned char valueData[valueLength
 *                     ((B3 & 0x7f) << 24) + (B2 << 16) + (B1 << 8) + B0];
 *         } FCGI_NameValuePair14;
 *
 *         typedef struct {
 *             unsigned char nameLengthB3;  // nameLengthB3  >> 7 == 1
 *             unsigned char nameLengthB2;
 *             unsigned char nameLengthB1;
 *             unsigned char nameLengthB0;
 *             unsigned char valueLengthB0; // valueLengthB0 >> 7 == 0
 *             unsigned char nameData[nameLength
 *                     ((B3 & 0x7f) << 24) + (B2 << 16) + (B1 << 8) + B0];
 *             unsigned char valueData[valueLength];
 *         } FCGI_NameValuePair41;
 *
 *         typedef struct {
 *             unsigned char nameLengthB3;  // nameLengthB3  >> 7 == 1
 *             unsigned char nameLengthB2;
 *             unsigned char nameLengthB1;
 *             unsigned char nameLengthB0;
 *             unsigned char valueLengthB3; // valueLengthB3 >> 7 == 1
 *             unsigned char valueLengthB2;
 *             unsigned char valueLengthB1;
 *             unsigned char valueLengthB0;
 *             unsigned char nameData[nameLength
 *                     ((B3 & 0x7f) << 24) + (B2 << 16) + (B1 << 8) + B0];
 *             unsigned char valueData[valueLength
 *                     ((B3 & 0x7f) << 24) + (B2 << 16) + (B1 << 8) + B0];
 *         } FCGI_NameValuePair44;
 *
 */
export class CmdParams extends FcgCommand {

    params: string[][] = []

    constructor(reqId: number) {
        super(FcgType.PARAMS, reqId);
    }

    pack(pkt: FcgPacket) {
        let acc = pkt.newDataAccessor();
        for(const [name, value] of this.params) {
            this.writeLength(name.length, acc);
            this.writeLength(value.length, acc);

            acc.putString(name);
            acc.putString(value);
        }

        // must be called from last line
        super.pack(pkt);
    }

    unpack(pkt: FcgPacket) {
        super.unpack(pkt);
        let acc = pkt.newDataAccessor();
        while(acc.pos < pkt.dataLen()) {
            let nameLen = this.readLength(acc);
            let valueLen = this.readLength(acc);

            let data = Buffer.alloc(nameLen);
            acc.getBytes(data, 0, data.length);
            let name = data.toString("latin1");

            data = Buffer.alloc(valueLen);
            acc.getBytes(data, 0, data.length);
            let value = data.toString("latin1")

            BayLog.trace("Params: %s=%s", name, value);
            this.addParam(name, value);
        }
    }

    handle(handler: FcgCommandHandler): number {
        return handler.handleParams(this);
    }

    readLength(acc: PacketPartAccessor): number {
        let len = acc.getByte();
        if(len >> 7 == 0) {
            return len;
        }
        else {
            let len2 = acc.getByte();
            let len3 = acc.getByte();
            let len4 = acc.getByte();
            return ((len & 0x7f) << 24) | (len2 << 16) | (len3 << 8) | len4;
        }
    }

    writeLength(len: number, acc: PacketPartAccessor): void {
        if(len  >> 7 == 0) {
            acc.putByte(len);
        }
        else {
            let len1 = (len >> 24 & 0xFF) | 0x80;
            let len2 = len >> 16 & 0xFF;
            let len3 = len >> 8 & 0xFF;
            let len4 = len & 0xFF;
            acc.putBytes(Buffer.of(len1, len2, len3, len4))
        }
    }

    addParam(name: string, value: string): void {
        if(name == null)
            throw new Error("NullPo");
        if(value == null)
            value = "";
        this.params.push([name, value]);
    }
}