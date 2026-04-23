import {BayLog} from "../../bayLog";
import {FileContent} from "./fileContent";

export class FileContentStatus {
    static readonly STARTED = 1;
    static readonly COMPLETED = 3;
    static readonly EXCEEDED = 4;

    fileContent: FileContent;
    status: number;

    constructor(fileContent: FileContent, status: number) {
        this.fileContent = fileContent;
        this.status = status;
    }
}

/**
 * Simple LRU-ish file cache.
 *
 * Concurrent-miss de-duplication (WaitFileShip in the Java version) is
 * intentionally omitted; each miss reads the file independently and the
 * first one to finish wins the cache slot.
 */
export class FileStore {

    private readonly contents: Map<string, FileContent> = new Map()
    readonly limitBytes: number
    private totalBytes: number = 0
    private readonly lifespanMilliSec: number

    constructor(timeoutSec: number, limitBytes: number) {
        this.lifespanMilliSec = timeoutSec * 1000
        this.limitBytes = limitBytes
    }

    get(path: string, fileSize: number): FileContentStatus {
        let fileContent = this.contents.get(path)

        if (fileContent != null) {
            if (fileContent.loadedTime + this.lifespanMilliSec < Date.now()) {
                this.totalBytes -= fileContent.length
                BayLog.debug("Remove expired content: %s", path)
                this.contents.delete(path)
                fileContent = null
            }
            else if (fileContent.isLoaded()) {
                return new FileContentStatus(fileContent, FileContentStatus.COMPLETED)
            }
            else {
                // A previous miss is still populating this entry; treat as not
                // cached for this caller so it reads independently.
                fileContent = null
            }
        }

        let exceeded = false
        if (fileSize > this.limitBytes) {
            exceeded = true
        }
        else if (this.totalBytes + fileSize > this.limitBytes) {
            if (!this.evict()) {
                exceeded = true
            }
        }

        if (exceeded) {
            return new FileContentStatus(null, FileContentStatus.EXCEEDED)
        }

        fileContent = new FileContent(path, fileSize)
        this.contents.set(path, fileContent)
        this.totalBytes += fileSize
        return new FileContentStatus(fileContent, FileContentStatus.STARTED)
    }

    private evict(): boolean {
        let evicted = false
        const now = Date.now()
        for (const [key, entry] of this.contents) {
            if (!entry.isLoaded())
                continue
            if (entry.loadedTime + this.lifespanMilliSec < now) {
                BayLog.debug("Remove expired content: %s", key)
                this.totalBytes -= entry.length
                this.contents.delete(key)
                evicted = true
            }
            else {
                break
            }
        }
        return evicted
    }
}
