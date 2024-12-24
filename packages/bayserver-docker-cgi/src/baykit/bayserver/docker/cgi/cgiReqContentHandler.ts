import {CgiDocker} from "./cgiDocker";
import {Tour} from "bayserver-core/baykit/bayserver/tour/tour";
import {ReqContentHandler} from "bayserver-core/baykit/bayserver/tour/reqContentHandler";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {ChildProcess} from "child_process";
import * as child_process from "child_process";
import {IOException} from "bayserver-core/baykit/bayserver/util/ioException";
import {ContentConsumeListener} from "bayserver-core/baykit/bayserver/tour/contentConsumeListener";
import {GrandAgent} from "bayserver-core/baykit/bayserver/agent/grandAgent";
import {Postpone} from "bayserver-core/baykit/bayserver/common/postpone";
import {ReadableRudder} from "bayserver-core/baykit/bayserver/rudder/readableRudder";
import {Multiplexer} from "bayserver-core/baykit/bayserver/common/multiplexer";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {MULTIPLEXER_TYPE_VALVE} from "bayserver-core/baykit/bayserver/docker/harbor";
import {Sink} from "bayserver-core/baykit/bayserver/sink";
import {CgiStdOutShip} from "./cgiStdOutShip";
import {PlainTransporter} from "bayserver-core/baykit/bayserver/agent/multiplexer/plainTransporter";
import {RudderState} from "bayserver-core/baykit/bayserver/agent/multiplexer/rudderState";
import {CgiStdErrShip} from "./cgiStdErrShip";

export class CgiReqContentHandler implements ReqContentHandler, Postpone {

    private readonly cgiDocker: CgiDocker;
    private readonly tour: Tour;
    private readonly tourId: number;
    private available: boolean;
    childProcess: ChildProcess;
    private isStdOutClosed: boolean;
    private isStdErrClosed: boolean;
    private finished: boolean = false;
    private exitCode: number = null
    private execError: Error = null
    private lastAccess: number
    private readonly env: {[key: string]: string}
    private buffers: [Buffer, ContentConsumeListener][] = []

    constructor(cgiDocker: CgiDocker, tour: Tour, env: {[key: string]: string}) {
        this.cgiDocker = cgiDocker;
        this.tour = tour;
        this.tourId = tour.id()
        this.env = env
        this.isStdOutClosed = true;
        this.isStdErrClosed = true;
        this.access()
    }


    //////////////////////////////////////////////////////
    // Implements ReqContentHandler
    //////////////////////////////////////////////////////

    onReadReqContent(tur: Tour, buf: Buffer, start: number, len: number, lis: ContentConsumeListener): void {
        BayLog.debug("%s CGI:onReadReqContent: len=%d", tur, len);
        if(this.childProcess != null) {
            this.writeToStdIn(tur, buf, start, len , lis)
        }
        else {
            // postponed
            let newBuf = Buffer.alloc(3);
            buf.copy(newBuf, 0, start, len);
            this.buffers.push([newBuf, lis]);
        }
        this.access()
    }

    onEndReqContent(tur: Tour): void {
        BayLog.debug("%s CGI:endReqContent", tur);
        this.access()
    }

    onAbortReq(tur: Tour): boolean {
        BayLog.debug("%s CGI:abortReq", tur);
        try {
            this.childProcess.stdin.end();
        } catch (e) {
            BayLog.error_e(e);
        }
        return false;  // not aborted immediately
    }

    //////////////////////////////////////////////////////
    // Implements Postpone
    //////////////////////////////////////////////////////

    run(): void {
        this.cgiDocker.subWaitCount()
        BayLog.debug("%s challenge postponed tour", this.tour, this.cgiDocker.getWaitCount());
        this.reqStartTour();
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    reqStartTour() {
        if(this.cgiDocker.addProcessCount()) {
            BayLog.debug("%s start tour: wait count=%d", this.tour, this.cgiDocker.getWaitCount());
            this.startTour();
        }
        else {
            BayLog.warn("%s Cannot start tour: wait count=%d", this.tour, this.cgiDocker.getWaitCount());
            let agt = GrandAgent.get(this.tour.ship.agentId);
            agt.addPostpone(this);
        }
        this.access();
    }

    startTour(): void {
        this.available = false;

        let cmdArgs = this.cgiDocker.createCommand(this.env)
        let cmd = cmdArgs[0]
        cmdArgs.shift()

        this.childProcess = child_process.spawn(
            cmd,
            cmdArgs,
            {
                stdio: ["pipe", "pipe", "pipe"],
                env: this.env
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
            for(const [buf, lis] of this.buffers) {
                BayLog.debug("%s write postponed data: len=%d", this.tour, buf.length);
                this.writeToStdIn(this.tour, buf, 0, buf.length, lis);
            }
        })

        this.isStdOutClosed = false;
        this.isStdErrClosed = false;

        let bufsize = this.tour.ship.protocolHandler.maxResPacketDataSize();
        let outRd = new ReadableRudder(this.childProcess.stdout)
        let errRd = new ReadableRudder(this.childProcess.stderr)

        let agt = GrandAgent.get(this.tour.ship.agentId)
        let mpx: Multiplexer = null

        switch(BayServer.harbor.getCgiMultiplexer()) {
            case MULTIPLEXER_TYPE_VALVE:
                mpx = agt.valveMultiplexer
                break

            default:
                throw new Sink()
        }

        let outShip = new CgiStdOutShip();
        let outTp = new PlainTransporter(mpx, outShip, false, bufsize, false);
        outTp.init()

        outShip.initStdOut(outRd, this.tour.ship.agentId, this.tour, outTp, this)

        mpx.addRudderState(
            outRd,
            new RudderState(outRd, outTp)
        )

        let sid = this.tour.ship.shipId
        this.tour.res.setConsumeListener((len, resume) => {
            if(resume)
                outShip.resumeRead(sid)
        })

        let errShip = new CgiStdErrShip();
        let errTp = new PlainTransporter(agt.netMultiplexer, errShip, false, bufsize, false);
        errTp.init()
        errShip.initStdErr(errRd, this.tour.ship.agentId, this)

        mpx.addRudderState(
            errRd,
            new RudderState(errRd, errTp)
        )

        mpx.reqRead(outRd)
        mpx.reqRead(errRd)


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

    private writeToStdIn(tur: Tour, buf: Buffer, start: number, len: number, lis: ContentConsumeListener): void {
        this.childProcess.stdin.write(buf.subarray(start, start + len), (err) => {
            if(err) {
                BayLog.error_e(err, "Process write error")
                tur.req.abort()
            }
            else
                tur.req.consumed(Tour.TOUR_ID_NOCHECK, len, lis);
        });
    }

    private processFinished(): void {
        BayLog.debug("%s CGI Process finished (done=%s closed=%s exited=%s", this.tour, this.finished, this.isClosed(), this.isExited());

        if(this.finished)
            return

        if(!this.isClosed() || !this.isExited())
            return

        let agtId = this.tour.ship.agentId

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
                this.tour.res.endResContent(this.tourId);
            }
        }
        catch(e) {
            if(e instanceof IOException)
                BayLog.debug_e(e)
            else
                BayLog.error_e(e);
        }

        this.cgiDocker.subProcessCount()
        if(this.cgiDocker.getWaitCount() > 0) {
            BayLog.warn("agt#%d Catch up postponed process: process wait count=%d", agtId, this.cgiDocker.getWaitCount());
            let agt = GrandAgent.get(agtId);
            agt.reqCatchUp();
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
