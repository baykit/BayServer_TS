import {Buffer} from "buffer";
import {Counter} from "../util/counter";
import {IOException} from "../util/ioException";

export type ReadHandler = (buf: Buffer, n: number) => void
export type WriteHandler = (n: number) => void
export type CloseHandler = () => void
export type ErrorHandler = (e: IOException) => void
export abstract class Rudder {

    private static counter = new Counter()

    id: number

    protected readHandler: ReadHandler
    protected writeHandler: WriteHandler
    protected closeHandler: CloseHandler
    protected errorHandler: ErrorHandler

    protected constructor() {
        this.id = Rudder.counter.next()
    }

    toString(): string {
        return this.constructor.name + "(" + this.id + ")"
    }

    registerReadHandler(callback: ReadHandler): void {
        this.readHandler = callback
    }

    registerWriteHandler(callback: WriteHandler): void {
        this.writeHandler = callback
    }

    registerCloseHandler(callback: CloseHandler): void {
        this.closeHandler = callback
    }

    registerErrorHandler(callback: ErrorHandler): void {
        this.errorHandler = callback
    }

    abstract key(): Object

    // Returns -1 when reached EOF
    abstract reqRead(buf: Buffer): void

    abstract reqWrite(buf: Buffer): void

    abstract reqClose(): void
}