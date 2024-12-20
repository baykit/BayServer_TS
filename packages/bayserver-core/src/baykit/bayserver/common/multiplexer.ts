import {Rudder} from "../rudder/rudder";
import {RudderState} from "../agent/multiplexer/rudderState";
import {Transporter} from "../agent/multiplexer/transporter";
import {DataConsumeListener} from "../util/dataConsumeListener";
import {ProtocolException} from "../protocol/protocolException";

export interface Multiplexer {

    addRudderState(rd: Rudder, st: RudderState): void

    removeRudderState(rd: Rudder): void

    getRudderState(rd: Rudder): RudderState

    getTransporter(rd: Rudder): Transporter

    reqAccept(rd: Rudder): void

    reqConnect(rd: Rudder, addr: string, port: number): void

    reqRead(rd: Rudder): void

    reqWrite(rd: Rudder, buf: Buffer, adr: string, tag: Object, listener: DataConsumeListener): void

    reqClose(rd: Rudder): void

    cancelRead(st: RudderState): void

    cancelWrite(st: RudderState): void

    nextAccept(st: RudderState): void
    nextRead(st: RudderState): void
    nextWrite(st: RudderState): void

    shutdown(): void

    isNonBlocking(): boolean
    useAsyncAPI(): boolean

    consumeOldestUnit(st: RudderState): boolean
    closeRudder(st: RudderState): void

    isBusy(): boolean
    onBusy(): void
    onFree(): void
}