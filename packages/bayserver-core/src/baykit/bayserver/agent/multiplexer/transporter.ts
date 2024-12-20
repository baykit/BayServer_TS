import {Reusable} from "../../util/Reusable";
import {Rudder} from "../../rudder/rudder";
import {DataConsumeListener} from "../../util/dataConsumeListener";

export interface Transporter extends Reusable {
    init(): void

    onConnect(rd: Rudder): number

    onRead(rd: Rudder, data: Buffer, adr: string): number

    onError(rd: Rudder, e: Error): void

    onClosed(rd: Rudder): void

    reqConnect(rd: Rudder, addr: string, port: number): void

    reqRead(rd: Rudder): void

    reqWrite(rd: Rudder, buf: Buffer, adr: string, tag: Object, listener: DataConsumeListener): void

    reqClose(rd: Rudder): void

    checkTimeout(rd: Rudder, durationSec: number): boolean

    getReadBufferSize(): number

    /**
     * print memory usage
     */
    printUsage(indent: number): void
}