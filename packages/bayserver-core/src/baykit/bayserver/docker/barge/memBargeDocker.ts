import {DockerBase} from "../base/dockerBase";
import {Barge} from "../barge";
import {Tour} from "../../tour/tour";
import {Rudder} from "../../rudder/rudder";
import {HttpHeaders} from "../../util/httpHeaders";
import {BcfElement} from "../../bcf/bcfElement";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {Docker} from "../docker";
import {ConfigException} from "../../configException";
import {StrUtil} from "../../util/strUtil";
import {BayServer} from "../../bayserver";
import {BayLog} from "../../bayLog";
import {SimpleBuffer} from "../../util/simpleBuffer";
import {Buffer} from "buffer";
import {IOException} from "../../util/ioException";

const STATUS_LOADING = 1;
const STATUS_LOADED = 2;
const STATUS_EXCEEDED = 3;

/**
 * Pipe-equivalent rudder used to wake a tour that is waiting for a
 * cargo to finish loading.
 *
 * Java uses java.nio.channels.Pipe so the wait integrates with the
 * selector loop. Node.js is single-threaded, so we simulate the wake-up
 * with setImmediate when the writer side is "written".
 */
class WaitRudder extends Rudder {
    constructor() {
        super();
    }

    key(): Object {
        return this;
    }

    reqRead(buf: Buffer): void {
        // No-op until wakeUp() fires. The multiplexer will register a
        // readHandler that we call from wakeUp().
    }

    reqWrite(buf: Buffer): void {
        // Writer side: wake up readers asynchronously
        setImmediate(() => {
            try {
                if (this.readHandler != null) {
                    this.readHandler(buf, buf.length);
                }
            }
            catch (e) {
                BayLog.error_e(e as Error);
            }
        });
    }

    reqClose(): void {
        this._closed = true;
        if (this.closeHandler != null)
            this.closeHandler();
    }
}

export class MemCargo implements Barge.Cargo {
    docker: MemBargeDocker
    path: string
    length: number = 0
    status: number
    buf: SimpleBuffer = new SimpleBuffer()
    headers: HttpHeaders = new HttpHeaders()
    lastAccessedTimeMillis: number = 0
    waiters: Rudder[] = []

    constructor(docker: MemBargeDocker, path: string) {
        this.docker = docker;
        this.path = path;
        this.status = STATUS_LOADING;
    }

    ////////////////////////////////////////////
    // Implements Cargo
    ////////////////////////////////////////////

    getPath(): string {
        return this.path;
    }

    getHeaders(): HttpHeaders {
        return this.headers;
    }

    getContent(): Buffer {
        return this.buf.bytes();
    }

    getLength(): number {
        return this.buf.len;
    }

    isOnBarge(): boolean {
        return this.status == STATUS_LOADED;
    }

    isExceeded(): boolean {
        return this.status == STATUS_EXCEEDED;
    }

    saveHeaders(headers: HttpHeaders): void {
        if (this.isOnBarge())
            throw new Error("already saved");
        if (this.isExceeded())
            return;

        headers.copyTo(this.headers);
    }

    saveContent(bytes: Buffer, offset: number, len: number): void {
        if (this.isOnBarge())
            throw new Error("already saved");
        if (this.isExceeded())
            return;

        BayLog.debug("%s save content len=%d", this, len);
        this.length += len;

        if (this.length > BayServer.harbor.getMaxCargoSize()) {
            BayLog.debug("%s cargo exceeded: len=%d max=%d", this, this.length, BayServer.harbor.getMaxCargoSize());
            this.status = STATUS_EXCEEDED;
            this.buf.reset();
            return;
        }
        else {
            this.buf.put(bytes, offset, len);
        }
    }

    endSave(): void {
        if (this.isOnBarge())
            throw new Error("already saved");
        if (this.isExceeded())
            return;

        BayLog.debug("%s end save", this);
        this.status = STATUS_LOADED;
        this.docker.addTotal(this.length);

        const wakeBuf = Buffer.alloc(1);
        for (const rd of this.waiters) {
            try {
                BayLog.debug("%s notify waiter", this);
                rd.reqWrite(wakeBuf);
            }
            catch (e) {
                if (e instanceof IOException)
                    BayLog.error_e(e);
                else
                    throw e;
            }
        }
    }

    releaseRudder(rudder: Rudder): void {
        const idx = this.waiters.indexOf(rudder);
        if (idx >= 0)
            this.waiters.splice(idx, 1);
    }

    ////////////////////////////////////////////
    // Private methods
    ////////////////////////////////////////////
    access(): void {
        this.lastAccessedTimeMillis = Date.now();
    }

    expired(): boolean {
        return this.waiters.length == 0 &&
            Date.now() - this.lastAccessedTimeMillis > BayServer.harbor.getCargoLifespanSec() * 1000;
    }

    addWaiter(rd: Rudder): void {
        this.waiters.push(rd);
    }
}

export class MemBargeDocker extends DockerBase implements Barge {

    name: string
    capacity: number = 32 * 1024 * 1024  // 32MB
    totalSize: number = 0

    // TS Map preserves insertion order. To emulate LinkedHashMap access-order,
    // we delete + re-insert on access (move-to-end).
    private cargoMap: Map<string, MemCargo> = new Map()

    toString(): string {
        return "MemBargeDocker[" + this.name + "]";
    }

    ///////////////////////////////////////////////////////////////////////
    // Implements Docker
    ///////////////////////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker): void {
        super.init(elm, parent);
        this.name = elm.arg;
        if (StrUtil.empty(this.name))
            this.name = "*";
    }

    getType(): string {
        return "barge";
    }

    ///////////////////////////////////////////////////////////////////////
    // Implements DockerBase
    ///////////////////////////////////////////////////////////////////////

    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "capacity":
                this.capacity = StrUtil.parseSize(kv.value);
                break;
        }
        return true;
    }

    ////////////////////////////////////////////
    // Implements Barge
    ////////////////////////////////////////////

    getName(): string {
        return this.name;
    }

    getCapacity(): number {
        return this.capacity;
    }

    getCargo(tour: Tour): [Barge.Cargo, Rudder] {
        const path = tour.req.uri;
        let cgo = this.cargoMap.get(path);
        let sourceRd: Rudder = null;

        if (cgo != null && cgo.waiters.length == 0 && cgo.expired()) {
            this.totalSize -= cgo.getLength();
            this.cargoMap.delete(path);
            cgo = null;
        }

        if (cgo == null) {
            cgo = new MemCargo(this, path);
            this.cargoMap.set(path, cgo);
            tour.res.directBoarding = false; // Don't use OS cache (sendfile API)
        }
        else {
            // Move to end (most recently accessed)
            this.cargoMap.delete(path);
            this.cargoMap.set(path, cgo);

            if (cgo.status == STATUS_LOADING) {
                // Cargo is loading - create a wait rudder pair
                BayLog.debug("%s Cannot start tour (file reading)", tour);
                const waitRd = new WaitRudder();
                sourceRd = waitRd;
                cgo.addWaiter(waitRd);
            }
            else {
                tour.res.directBoarding = false;
            }
        }
        cgo.access();
        return [cgo, sourceRd];
    }

    ////////////////////////////////////////////
    // Private methods
    ////////////////////////////////////////////

    addTotal(len: number): void {
        this.totalSize += len;
        BayLog.debug("%s addTotal=%d", this, this.totalSize);
        const it = this.cargoMap.entries();
        let next = it.next();
        while (this.totalSize > this.capacity && !next.done) {
            const [key, eldest] = next.value;
            BayLog.debug("%s Remove cargo: %s cur total=%d", this, key, this.totalSize);
            if (eldest.waiters.length == 0) {
                this.totalSize -= eldest.getLength();
                this.cargoMap.delete(key);
            }
            BayLog.debug("%s cargo removed: total=%d", this, this.totalSize);
            next = it.next();
        }
    }
}

module.exports = {
    createDocker: (): Docker => new MemBargeDocker()
}
