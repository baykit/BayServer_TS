import {WarpData} from "./warpData";
import {Tour} from "../../tour/tour";
import {DataConsumeListener} from "../../util/dataConsumeListener";

export interface WarpHandler {

    nextWarpId(): number

    newWarpData(warpId: number): WarpData

    postWarpHeaders(tur: Tour): void

    postWarpContents(tur: Tour, buf: Buffer, start: number, len: number, lis: DataConsumeListener): void

    postWarpEnd(tur: Tour): void

    /**
     * Verify if protocol is allowed
     */
    verifyProtocol(protocol: string): void
}