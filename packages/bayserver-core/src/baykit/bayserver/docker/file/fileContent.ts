import {Buffer} from "buffer";

export class FileContent {
    readonly path: string
    readonly content: Buffer
    readonly length: number
    written: number = 0
    readonly loadedTime: number

    constructor(path: string, length: number) {
        this.path = path
        this.length = length
        this.content = Buffer.alloc(length)
        this.loadedTime = Date.now()
    }

    isLoaded(): boolean {
        return this.written >= this.length
    }

    append(src: Buffer, len: number): void {
        src.copy(this.content, this.written, 0, len)
        this.written += len
    }
}
