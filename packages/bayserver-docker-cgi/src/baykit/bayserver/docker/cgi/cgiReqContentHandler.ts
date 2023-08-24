import {CgiDocker} from "./cgiDocker";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {ReqContentHandler} from "bayserver-core/baykit/bayserver/tour/reqContentHandler";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {ChildProcess} from "child_process";
import * as child_process from "child_process";

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


    constructor(cgiDocker: CgiDocker, tour: Tour) {
        this.cgiDocker = cgiDocker;
        this.tour = tour;
        this.tourId = tour.id()
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
    }

    onEndContent(tur: Tour): void {
        BayLog.debug("%s CGI:endReqContent", tur);
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
            BayLog.debug("%s exit process: %d", this.tour, code)
            this.exitCode = code
            this.processFinished()
        })
        this.childProcess.on("spawn", () => {
            BayLog.debug("Process spawned")
        })

        this.cgiDocker.onProcessStarted(this.tour, this)
        this.isStdOutClosed = false;
        this.isStdErrClosed = false;
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

    private processFinished() {
        if(this.finished)
            return

        if(!this.isClosed() || !this.isExited())
            return

        try {
            BayLog.trace(this.tour + " CGITask: process ended");

            BayLog.debug("%s CGI Process finished: code=%d", this.tour, this.exitCode);

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
            BayLog.error_e(e, "%s Error on notify CGI status", this.tour);
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