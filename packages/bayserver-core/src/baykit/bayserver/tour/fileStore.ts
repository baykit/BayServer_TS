import {Rudder} from "../rudder/rudder";
import {BayLog} from "../bayLog";
import {BayServer} from "../bayserver";
import {SysUtil} from "../util/sysUtil";
import {DirectoryException} from "../util/directoryException";
import {FileRudder} from "../rudder/fileRudder";
import * as fs from "fs";

export class FileInfo {
    fileName: string
    rudder: Rudder
    fileLength: number
    lastAccessTime: number

    constructor(fileName: string, rd: Rudder, len: number) {
        this.fileName = fileName
        this.rudder = rd
        this.fileLength = len
        this.access()
    }

    access(): void {
        this.lastAccessTime = Date.now()
    }

    close(): void {
        try {
            this.rudder.reqClose()
        } catch (e) {
            BayLog.error_e(e)
        }
        this.rudder = null
    }
}

/**
 * Caches file descriptors used for Direct Boarding (sendfile-equivalent).
 * Uses Map insertion order plus delete/set-on-access to emulate LinkedHashMap
 * access-order behavior.
 */
export class FileStore {

    private static instance: FileStore = null

    private readonly files: Map<string, FileInfo> = new Map()
    readonly maxCargos: number
    private readonly lifespanMilliSec: number
    private readonly maxCargoSize: number

    constructor(timeoutSec: number, maxCargos: number, maxCargoSize: number) {
        this.lifespanMilliSec = timeoutSec * 1000
        this.maxCargos = maxCargos
        this.maxCargoSize = maxCargoSize
    }

    get(path: string): FileInfo {
        let info = this.files.get(path)
        if (info != null && Date.now() > info.lastAccessTime + this.lifespanMilliSec) {
            BayLog.info("%d %d %d %d", info.lastAccessTime, this.lifespanMilliSec, info.lastAccessTime + this.lifespanMilliSec, Date.now())
            info.close()
            this.files.delete(path)
            info = null
        }

        if (info == null) {
            if (SysUtil.isDirectory(path)) {
                throw new DirectoryException()
            }

            const size = SysUtil.getFileSize(path)
            if (size > this.maxCargoSize) {
                info = new FileInfo(path, null, size)
            }
            else {
                const fd = fs.openSync(path, "r")
                const rd = new FileRudder(fd)
                info = new FileInfo(path, rd, size)
            }

            this.files.set(path, info)
            this.evictIfNeeded()
        }
        else {
            // Move to end (most recently accessed)
            this.files.delete(path)
            this.files.set(path, info)
        }

        info.access()
        return info
    }

    private evictIfNeeded(): void {
        while (this.files.size > this.maxCargos) {
            const eldest = this.files.keys().next().value
            const info = this.files.get(eldest)
            BayLog.debug("Evict cargo: %s", eldest)
            info.close()
            this.files.delete(eldest)
        }
    }

    static getFileStore(): FileStore {
        if (FileStore.instance == null) {
            FileStore.instance = new FileStore(
                BayServer.harbor.getCargoLifespanSec(),
                BayServer.harbor.getMaxDirectBoardings(),
                BayServer.harbor.getMaxCargoSize() * 1024 * 1024)
        }
        return FileStore.instance
    }
}
