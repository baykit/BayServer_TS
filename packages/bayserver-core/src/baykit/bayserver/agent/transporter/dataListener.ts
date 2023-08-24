import {ProtocolException} from "../../protocol/protocolException";

export interface DataListener {

    notifyConnect() : number

    notifyRead(buf: Buffer, adr): number

    notifyEof(): number

    notifyError(err: Error): void

    notifyHandshakeDone(protocol: string): number

    notifyProtocolError(e: ProtocolException): boolean

    notifyClose(): void

    checkTimeout(durationSec: number): boolean
}