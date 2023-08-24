import {ProtocolException} from "../../protocol/protocolException";
import {Tour} from "../../tour/tour";
import {DataConsumeListener} from "../../util/dataConsumeListener";

export interface InboundHandler {

    /**
     * Send protocol error
     */
    sendReqProtocolError(e: ProtocolException): boolean;

    /**
     * Send HTTP headers to client
     */
    sendResHeaders(tur: Tour);

    /**
     * Send Contents to client
     */
    sendResContent(tur: Tour, bytes: Buffer, ofs: number, len: number, lis: DataConsumeListener);

    /**
     * Send end of contents to client.
     */
    sendEndTour(tur: Tour, keepAlive: boolean, lis: DataConsumeListener);


}
