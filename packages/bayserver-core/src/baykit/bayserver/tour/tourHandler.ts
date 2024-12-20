import {Tour} from "./tour";
import {Buffer} from "buffer";
import {ProtocolException} from "../protocol/protocolException";
import {DataConsumeListener} from "../util/dataConsumeListener";

export interface TourHandler {
    /**
     * Send HTTP headers to client
     */
    sendResHeaders(tur: Tour): void

    /**
     * Send Contents to client
     */
    sendResContent(tur: Tour, bytes: Buffer, of: number, len: number, lis: DataConsumeListener): void

    /**
     * Send end of req contents to client.
     */
    sendEndTour(tur: Tour, keepAlive: boolean, lis: DataConsumeListener): void

    /**
     * Send protocol error to client
     */
    onProtocolError(e: ProtocolException): boolean
}