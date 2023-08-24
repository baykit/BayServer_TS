import {Packet} from "bayserver-core/baykit/bayserver/protocol/packet";
import {PacketPartAccessor} from "bayserver-core/baykit/bayserver/protocol/packetPartAccessor";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {Buffer} from "buffer";

/**
 * AJP Protocol
 * https://tomcat.apache.org/connectors-doc/ajp/ajpv13a.html
 *
 * AJP packet spec
 *
 *   packet:  preamble, length, body
 *   preamble:
 *        0x12, 0x34  (client->server)
 *     | 'A', 'B'     (server->client)
 *   length:
 *      2 byte
 *   body:
 *      $length byte
 *
 *
 *  Body format
 *    client->server
 *    Code     Type of Packet    Meaning
 *       2     Forward Request   Begin the request-processing cycle with the following data
 *       7     Shutdown          The web server asks the container to shut itself down.
 *       8     Ping              The web server asks the container to take control (secure login phase).
 *      10     CPing             The web server asks the container to respond quickly with a CPong.
 *    none     Data              Size (2 bytes) and corresponding body data.
 *
 *    server->client
 *    Code     Type of Packet    Meaning
 *       3     Send Body Chunk   Send a chunk of the body from the servlet container to the web server (and presumably, onto the browser).
 *       4     Send Headers      Send the response headers from the servlet container to the web server (and presumably, onto the browser).
 *       5     End Response      Marks the end of the response (and thus the request-handling cycle).
 *       6     Get Body Chunk    Get further data from the request if it hasn't all been transferred yet.
 *       9     CPong Reply       The reply to a CPing request
 *
 */
export class AjpAccessor extends PacketPartAccessor {

    constructor(pkt: Packet, start: number, maxLen: number) {
        super(pkt, start, maxLen);
    }

    putString(str: string) : void {
        if (StrUtil.empty(str)) {
            this.putShort(0xffff);
        }
        else {
            this.putShort(str.length);
            super.putString(str);
            this.putByte(0); // null terminator
        }
    }

    getString() : string {
        return this.getStringByLen(this.getShort());
    }

    getStringByLen(len: number) : string {

        if (len == 0xffff) {
            return "";
        }

        let buf: Buffer = Buffer.alloc(len);
        this.getBytes(buf);
        this.getByte(); // null terminator

        return buf.toString();
    }
}
export class AjpPacket extends Packet {

    static readonly PREAMBLE_SIZE: number = 4;
    static readonly MAX_DATA_LEN: number = 8192 - AjpPacket.PREAMBLE_SIZE;
    static readonly MIN_BUF_SIZE: number = 1024;

    toServer: boolean;

    constructor(type: number) {
        super(type, AjpPacket.PREAMBLE_SIZE, AjpPacket.MAX_DATA_LEN);
    }

    reset() : void {
        this.toServer = false;
        super.reset();
    }

    toString(): string {
        return "AjpPacket(" + this.type + ")";
    }

    newAjpHeaderAccessor() : AjpAccessor {
        return new AjpAccessor(this, 0, AjpPacket.PREAMBLE_SIZE);
    }

    newAjpDataAccessor() : AjpAccessor {
        return new AjpAccessor(this, AjpPacket.PREAMBLE_SIZE, -1);
    }
}
