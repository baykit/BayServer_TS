import {CgiDocker} from "./cgiDocker";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {ReqContentHandler} from "bayserver-core/baykit/bayserver/tour/reqContentHandler";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {ChildProcess} from "child_process";
import * as child_process from "child_process";
import {IOException} from "bayserver-core/baykit/bayserver/util/ioException";

export class CgiReqContentHandler implements ReqContentHandler{

    readonly cgiDocker: CgiDocker;
    readonly tour: Tour;
    readonly tourId: number;
    available: boolean;
    childProcess: ChildProcess;
    isStdOutClosed: boolean;
    isStdErrClosed: boolean;
    private finished: boolean = false;
    private exitCode: number = null
    private execError: Error = null
    private lastAccess: number


    constructor(cgiDocker: CgiDocker, tour: Tour) {
        this.cgiDocker = cgiDocker;
        this.tour = tour;
        this.tourId = tour.id()
        this.isStdOutClosed = true;
        this.isStdErrClosed = true;
        this.access()
    }



    //////////////////////////////////////////////////////
    // Implements ReqContentHandler
    //////////////////////////////////////////////////////

    onReadContent(tur: Tour, buf: Buffer, start: number, len: number): void {
        BayLog.debug("%s CGI:onReadReqContent: len=%d", tur, len);
        this.childProcess.stdin.write(buf.subarray(start, start + len), (err) => {
            if(err) {
                BayLog.error_e(err, "Process write error")
                tur.req.abort()
            }
            else
                tur.req.consumed(Tour.TOUR_ID_NOCHECK, len);
        });
        this.access()
    }

    onEndContent(tur: Tour): void {
        BayLog.debug("%s CGI:endReqContent", tur);
        this.access()
    }

    onAbort(tur: Tour): boolean {
        BayLog.debug("%s CGI:abortReq", tur);
        try {
            this.childProcess.stdin.end();
        } catch (e) {
            BayLog.error_e(e);
        }
        return false;  // not aborted immediately
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    startTour(env: {[key: string]: string}): void {
        this.available = false;

        let cmdArgs = this.cgiDocker.createCommand(env)
        let cmd = cmdArgs[0]
        cmdArgs.shift()

        this.childProcess = child_process.spawn(
            cmd,
            cmdArgs,
            {
                stdio: ["pipe", "pipe", "pipe"],
                env: env
            })
        BayLog.debug("%s created process: %d", this.tour, this.childProcess.pid);

        this.childProcess.on("error", (err) => {
            BayLog.debug_e(err, "%s Spawn error", this.tour)
            this.execError = err
        })
        this.childProcess.on("exit", (code) => {
            if(code == null)
                code = -1
            BayLog.debug("%s exit process: pid=%d code=%d", this.tour, this.childProcess.pid, code)
            this.exitCode = code
            this.processFinished()
        })
        this.childProcess.on("spawn", () => {
            BayLog.debug("%s Process spawned: pid=%s", this.tour, this.childProcess.pid)
        })

        this.cgiDocker.onProcessStarted(this.tour, this)
        this.isStdOutClosed = false;
        this.isStdErrClosed = false;
        this.access()
    }

    stdOutClosed() {
        this.isStdOutClosed = true
        if(this.isStdOutClosed && this.isStdErrClosed)
            this.processFinished()
    }

    stdErrClosed() {
        this.isStdErrClosed = true
        if(this.isStdOutClosed && this.isStdErrClosed)
            this.processFinished()
    }

    access(): void {
        this.lastAccess = Date.now()
    }

    timedOut() : boolean {
        if(this.cgiDocker.timeoutSec <= 0)
            return false

        let durationSec = (Date.now() - this.lastAccess) / 1000
        BayLog.debug("%s Check CGI timeout: dur=%d, timeout=%d", this.tour, durationSec, this.cgiDocker.timeoutSec)
        return durationSec > this.cgiDocker.timeoutSec
    }

    private processFinished() {
        BayLog.debug("%s CGI Process finished (done=%s closed=%s exited=%s", this.tour, this.finished, this.isClosed(), this.isExited());

        if(this.finished)
            return

        if(!this.isClosed() || !this.isExited())
            return

        let tourId = this.tour.id()
        try {
            BayLog.trace(this.tour + " CGITask: process ended");

            BayLog.debug("%s CGI Process exit code=%d", this.tour, this.exitCode);

            if(this.execError) {
                BayLog.error("%s CGI Spawn error", this.tour);
                this.tour.res.sendError(this.tourId, HttpStatus.INTERNAL_SERVER_ERROR, "Cannot create process", this.execError);
            }
            else if (this.exitCode != 0 && !this.tour.res.headerSent) {
                // Exec failed
                BayLog.error("%s CGI exit code=%d", this.tour, this.exitCode & 0xff);
                this.tour.res.sendError(this.tourId, HttpStatus.INTERNAL_SERVER_ERROR, "Invalid exit status");
            }
            else {
                this.tour.res.endContent(this.tourId);
            }
        }
        catch(e) {
            if(e instanceof IOException)
                BayLog.debug_e(e)
            else
                BayLog.error_e(e);
        }

        this.finished = true
    }

    private isClosed(): boolean {
        return this.isStdOutClosed && this.isStdErrClosed
    }

    private isExited(): boolean {
        return this.exitCode != null || this.execError != null
    }
}
