import {WarpData} from "./warpData";
import {Tour} from "../tour/tour";
import {Buffer} from "buffer";
import {DataConsumeListener} from "../util/dataConsumeListener";

export interface WarpHandler {

    nextWarpId(): number

    newWarpData(warpId: number): WarpData

    sendReqHeaders(tur: Tour): void

    sendReqContent(tur: Tour, buf: Buffer, start: number, len: number, lis: DataConsumeListener): void

    sendEndReq(tur: Tour, keepAlive: boolean, lis: DataConsumeListener): void

    /**
     * Verify if protocol is allowed
     */
    verifyProtocol(protocol: string): void
}