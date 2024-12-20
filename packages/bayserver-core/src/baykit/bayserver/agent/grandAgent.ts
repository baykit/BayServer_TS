import {BayLog} from "../bayLog";
import {LifeCycleListener} from "./lifeCycleListener";
import {MemUsage} from "../memUsage";
import {CommandReceiver} from "./commandReceiver";
import {BayServer} from "../bayserver";
import {fork} from "child_process";
import {TimerHandler} from "./timerHandler";
import {ArrayUtil} from "../util/arrayUtil";
import {Multiplexer} from "../common/multiplexer";
import {PigeonMultiplexer} from "./multiplexer/pigeonMultiplexer";
import {Recipient} from "../common/recipient";
import {RudderState} from "./multiplexer/rudderState";
import {EventRecipient} from "./multiplexer/eventRecipient";
import {BayMessage} from "../bayMessage";
import {Symbol} from "../symbol";
import {IOException} from "../util/ioException";
import {NextSocketAction} from "./nextSocketAction";
import {HttpException} from "../httpException";
import {Sink} from "../sink";
import {Rudder} from "../rudder/rudder";
import {PlainTransporter} from "./multiplexer/plainTransporter";
import {ServerRudder} from "../rudder/serverRudder";
import {AcceptedLetter} from "./letter/acceptedLetter";
import {ConnectedLetter} from "./letter/connectedLetter";
import {ReadLetter} from "./letter/readLetter";
import {WroteLetter} from "./letter/wroteLetter";
import {ClosedLetter} from "./letter/closedLetter";
import {ErrorLetter} from "./letter/errorLetter";
import {Letter} from "./letter/letter";
import {ValveMultiplexer} from "./multiplexer/valveMultiplexer";
import {MULTIPLEXER_TYPE_VALVE, RECIPIENT_TYPE_EVENT, RECIPIENT_TYPE_PIPE} from "../docker/harbor";
import {promisify} from "util";
import {finished} from "stream";
import * as fs from "fs";


export class GrandAgent {

    static readonly SELECT_TIMEOUT_SEC = 10

    static readonly CMD_OK = 0
    static readonly CMD_CLOSE = 1
    static readonly CMD_RELOAD_CERT = 2
    static readonly CMD_MEM_USAGE = 3
    static readonly CMD_SHUTDOWN = 4
    static readonly CMD_ABORT = 5
    static readonly CMD_FORK = 6

    static agentCount: number
    static maxAgentId: number = 0
    static maxShips: number
    static multiCore: boolean

    private static agents: Map<number, GrandAgent> = null

    static listeners: LifeCycleListener[] = [];

    agentId: number
    netMultiplexer: Multiplexer
    valveMultiplexer: ValveMultiplexer
    pigeonMultiplexer: PigeonMultiplexer
    recipient: Recipient
    letterQueue: Letter[] = []

    maxInboundShips: number
    aborted: boolean = false
    anchorable: boolean;

    private timerHandlers: TimerHandler[] = []
    private timerId: NodeJS.Timeout | null = null;
    commandReceiver: CommandReceiver

    private static readonly INTERVAL_SEC = 10;
    private interval_sec: number = 10;
    private lastTimeoutCheck: number


    private constructor(
        agentId: number,
        maxShips: number,
        anchorable: boolean) {
        this.agentId = agentId
        this.valveMultiplexer = new ValveMultiplexer(this, anchorable)
        this.pigeonMultiplexer = new PigeonMultiplexer(this, anchorable)
        this.anchorable = anchorable


        switch(BayServer.harbor.getRecipient()) {
            case RECIPIENT_TYPE_EVENT:
                this.recipient = new EventRecipient()
                break

            default:
                throw new Sink()
        }

        switch(BayServer.harbor.getNetMultiplexer()) {
            case MULTIPLEXER_TYPE_VALVE:
                this.netMultiplexer = this.valveMultiplexer
                break

            default:
                throw new Sink()
        }

        this.netMultiplexer = this.valveMultiplexer
        this.startTimer()
    }

    toString(): string {
        return "agt#" + this.agentId
    }

    async run(): Promise<void> {
        BayLog.info(BayMessage.get(Symbol.MSG_RUNNING_GRAND_AGENT, this));
        BayServer.originalConsoleLog("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        BayServer.originalConsoleLog("multiCode=" + BayServer.harbor.isMultiCore())
        try {
            if (this.anchorable) {
                // Adds server socket channel of anchorable ports
                for (const rd of BayServer.anchorablePortMap.keys()) {
                    this.netMultiplexer.addRudderState(rd, new RudderState(rd));
                }
            }


            let busy = true
            while (true) {
                let testBusy = this.netMultiplexer.isBusy();
                if (testBusy != busy) {
                    busy = testBusy;
                    if (busy) {
                        this.netMultiplexer.onBusy();
                    } else {
                        this.netMultiplexer.onFree();
                    }
                }

                await this.recipient.receive(true);

                //BayLog.debug("selected: %d", count);
                if (this.aborted) {
                    BayLog.info("%s aborted by another thread", this);
                    break;
                }

                if (this.letterQueue.length == 0) {
                    // timed out
                    // check per 10 seconds
                    let durationSec = Math.floor((Date.now() - this.lastTimeoutCheck) / 1000)
                    if (durationSec >= this.interval_sec) {
                        this.ring()
                    }
                }

                while (this.letterQueue.length > 0) {
                    let letter = this.letterQueue.shift()

                    if(letter instanceof AcceptedLetter) {
                        this.onAccepted(letter)
                    }
                    else if(letter instanceof ConnectedLetter) {
                        this.onConnected(letter)
                    }
                    else if(letter instanceof ReadLetter) {
                        this.onRead(letter)
                    }
                    else if(letter instanceof WroteLetter) {
                        this.onWrote(letter)
                    }
                    else if(letter instanceof ClosedLetter) {
                        this.onClosed(letter)
                    }
                    else if(letter instanceof ErrorLetter) {
                        this.onError(letter)
                    }
                }
            }
        }
        catch(e) {
            // If error occurs, grand agent ends
            BayLog.error_e(e)
            BayLog.fatal_e(e, "%s Fatal error!", this);
        }

        this.shutdown();
        BayLog.info("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        BayLog.info("shutdowned")
        BayLog.info("multiCode=" + BayServer.harbor.isMultiCore())

    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    stopTimer() {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    addTimerHandler(handler: TimerHandler) {
        this.timerHandlers.push(handler)
    }

    removeTimerHandler(handler: TimerHandler) {
        ArrayUtil.remove(handler, this.timerHandlers)
    }

    ring(): void {
        try {
            for (const h of this.timerHandlers) {
                h.onTimer()
            }
        }
        catch(e) {
            BayLog.fatal_e(e, "%s Error on handling timer")
            this.reqShutdown()
        }
    }

    addCommandReceiver(rd: Rudder) {
        BayLog.debug("%s add command receiver: rd=%s", this, rd)
        this.commandReceiver = new CommandReceiver()
        let comTransporter = new PlainTransporter(this.netMultiplexer, this.commandReceiver, true, 8, false);
        this.commandReceiver.init(this.agentId, rd, comTransporter);
        this.netMultiplexer.addRudderState(this.commandReceiver.rudder, new RudderState(this.commandReceiver.rudder, comTransporter));
        this.netMultiplexer.reqRead(this.commandReceiver.rudder)
    }

    sendAcceptedLetter(st: RudderState, clientRd: Rudder, wakeup: boolean): void {
        if(st == null)
            throw new Sink();
        this.sendLetter(new AcceptedLetter(st, clientRd), wakeup);
    }

    sendConnectedLetter(st: RudderState, wakeup: boolean): void {
        if(st == null)
            throw new Sink();
        this.sendLetter(new ConnectedLetter(st), wakeup);
    }

    sendReadLetter(st: RudderState, n: number, adr: string, wakeup: boolean): void {
        if(st == null)
            throw new Sink();
        this.sendLetter(new ReadLetter(st, n, adr), wakeup);
    }

    sendWroteLetter(st: RudderState, n: number, wakeup: boolean): void {
        if(st == null)
            throw new Sink();
        this.sendLetter(new WroteLetter(st, n), wakeup);
    }

    sendClosedLetter(st: RudderState, wakeup: boolean): void {
        if(st == null)
            throw new Sink();
        this.sendLetter(new ClosedLetter(st), wakeup);
    }

    sendErrorLetter(st: RudderState, e: Error, wakeup: boolean): void {
        if(st == null)
            throw new Sink();
        this.sendLetter(new ErrorLetter(st, e), wakeup);
    }

    reloadCert() {

    }

    printUsage() {
        // print memory usage
        BayLog.info("%s MemUsage", this);
        BayLog.info("  Node.js information: %s", JSON.stringify(process.versions, null, 2))
        const memoryUsage = process.memoryUsage();
        BayLog.info("  HeapTotal: %s Bytes", memoryUsage.heapTotal.toLocaleString('en-US'))
        BayLog.info("  HeapUsed: %s Bytes", memoryUsage.heapUsed.toLocaleString('en-US'))
        BayLog.info("  External: %s Bytes", memoryUsage.external.toLocaleString('en-US'))
        MemUsage.get(this.agentId).printUsage(1);
    }

    shutdown() {
        BayLog.debug("%s shutdown aborted=%s", this, this.aborted);
        if(this.aborted)
            return


        this.aborted = true

        BayLog.debug("%s shutdown netMultiplexer", this);
        this.netMultiplexer.shutdown();

        this.stopTimer()

        for(const lis of GrandAgent.listeners)
            lis.remove(this.agentId)

        this.commandReceiver.end()
        GrandAgent.agents.delete(this.agentId)

        //this.abort()
    }

    abort(err: Error = null) {
        if(err) {
            BayLog.fatal("%s abort", this)
            BayLog.fatal_e(err)
        }

        // Exit after 5 seconds
        /*
        setTimeout(() => {
            exit(1)
        }, 5000)

         */
    }

    reqShutdown() {
        BayLog.debug("%s req shutdown", this)
        this.aborted = true
        this.shutdown()
    }

    fork(agentId: number, monitorPort: number) {
        //BayLog.debug("%s fork: agtId=%d port=%d", this, agentId, monitorPort)
        let newArgv = []
        for (const arg of BayServer.scriptArgs) {
            if (!arg.startsWith("-agentid=") &&
                !arg.startsWith("-monitorPort=") &&
                !arg.startsWith("-openPort"))
                newArgv.push(arg)
        }
        newArgv.push("-agentid=" + agentId)
        newArgv.push("-monitorPort=" + monitorPort)
        let child = fork(BayServer.scriptName, newArgv)
        BayLog.debug("%s Child process spawned: child agt#%d pid=%d", this, agentId, child.pid)

        child.on("exit", (code, signal) => {
            BayLog.debug("%s child agt#%d is exited: code=%d sig=%d", this, agentId, code, signal)
        })

        for (const [rd, portDkr] of BayServer.anchorablePortMap) {
            //BayLog.debug("%s send server socket to agt#%d(port=%d)", this, agentId, portDkr.getPort())
            child.send("serverSocket", (rd as ServerRudder).server)
        }
    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////

    private startTimer() {
        this.timerId = setInterval(() => {
            //BayLog.debug("Invoke timer")
            this.recipient.wakeup()
        }, this.interval_sec * 1000);
    }

    private sendLetter(letter: Letter, wakeup: boolean) {
        //BayLog.debug("%s send letter(%d) len=%d", this, letter.type, this.letterQueue.length)
        this.letterQueue.push(letter)

        if(wakeup) {
            this.recipient.wakeup()
        }
    }

    private onAccepted(letter: AcceptedLetter) {
        try {
            let p = BayServer.anchorablePortMap.get(letter.state.rudder)
            p.onConnected(this.agentId, letter.clientRudder, letter.state.rudder)
        }
        catch(e) {
            if (e instanceof IOException) {
                letter.state.transporter.onError(letter.state.rudder, e)
                this.nextAction(letter.state, NextSocketAction.CLOSE, false)
            }
            else if(e instanceof HttpException) {
                BayLog.error_e(e)
                letter.state.multiplexer.reqClose(letter.clientRudder)
            }
            else
                throw e
        }

        if(!this.netMultiplexer.isBusy()) {
            letter.state.multiplexer.nextAccept(letter.state)
        }
    }

    private onConnected(letter: ConnectedLetter) : void {
        let st = letter.state;

        var nextAct: NextSocketAction
        try {
            nextAct = st.transporter.onConnect(st.rudder)
        }
        catch(e) {
            if(e instanceof IOException) {
                st.transporter.onError(st.rudder, e);
                nextAct = NextSocketAction.CLOSE
            }
            else
                throw e
        }

        if(nextAct == NextSocketAction.READ)
            st.multiplexer.cancelWrite(st)

        this.nextAction(st, nextAct, false)
    }

    private onRead(letter: ReadLetter) : void {
        let st = letter.state;
        if (st.closed) {
            BayLog.debug("%s Rudder is already closed: rd=%s", this, st.rudder);
            return;
        }

        var nextAct: NextSocketAction
        try {
            BayLog.debug("%s read %d bytes (rd=%s)", this, letter.nBytes, st.rudder);
            st.bytesRead += letter.nBytes;

            nextAct = st.transporter.onRead(st.rudder, st.readBuf, letter.address);
        }
        catch(e) {
            if (e instanceof IOException) {
                st.transporter.onError(st.rudder, e);
                nextAct = NextSocketAction.CLOSE;
            }
            else
                throw e
        }

        this.nextAction(st, nextAct, true);
    }

    private onWrote(letter: WroteLetter) : void {
        let st = letter.state;
        if (st.closed) {
            BayLog.debug("%s Rudder is already closed: rd=%s", this, st.rudder);
            return;
        }

        try {
            BayLog.debug("%s wrote %d bytes rd=%s qlen=%d", this, letter.nBytes, st.rudder, st.writeQueue.length);
            st.bytesWrote += letter.nBytes;

            if(st.writeQueue.length == 0)
                throw new Sink(this + " Write queue is empty: rd=" + st.rudder);

            st.multiplexer.consumeOldestUnit(st)

            let writeMore = true
            if (st.writeQueue.length == 0) {
                writeMore = false;
                st.writing = false;
            }

            if (writeMore) {
                st.multiplexer.nextWrite(st);
            }
            else {
                if(st.finale) {
                    // Close
                    BayLog.debug("%s finale return Close", this);
                    this.nextAction(st, NextSocketAction.CLOSE, false);
                }
                else {
                    // Write off
                    st.multiplexer.cancelWrite(st);
                }

            }
        }
        catch(e) {
            if (e instanceof IOException) {
                st.transporter.onError(st.rudder, e);
                this.nextAction(st, NextSocketAction.CLOSE, false);
            }
            else
                throw e
        }
    }

    private onClosed(letter: ClosedLetter) : void {
        BayLog.debug("%s closed rd=%s", this, letter.state.rudder);

        let st = letter.state
        if(st.closed)
            return;
        st.closed = true;

        this.netMultiplexer.removeRudderState(st.rudder);

        BayLog.trace("%s Flush buffer", this);
        while(st.multiplexer.consumeOldestUnit(st)) {
        }

        BayLog.trace("%s Call transporter", this);
        if (st.transporter != null)
            st.transporter.onClosed(st.rudder);

        letter.state.closed = true
        letter.state.access()
    }

    private onError(letter: ErrorLetter) {
        try {
            throw letter.err
        } catch (e) {
            if (e instanceof IOException) {
                letter.state.transporter.onError(letter.state.rudder, e)
                this.nextAction(letter.state, NextSocketAction.CLOSE, false)
            } else
                throw e
        }
    }

    private nextAction(st: RudderState, act: NextSocketAction, reading: boolean): void {
        BayLog.debug("%s next action: %s (reading=%s)", this, act, reading);
        let cancel = false;

        switch(act) {
            case NextSocketAction.CONTINUE:
                if(reading)
                    st.multiplexer.nextRead(st);
                break;

            case NextSocketAction.READ:
                st.multiplexer.nextRead(st);
                break;

            case NextSocketAction.WRITE:
                if(reading)
                    cancel = true;
                break;

            case NextSocketAction.CLOSE:
                if(reading)
                    cancel = true;
                st.multiplexer.reqClose(st.rudder);
                break;

            case NextSocketAction.SUSPEND:
                if(reading)
                    cancel = true;
                break;

            default:
                throw new Sink("NextAction=" + act);
        }

        if(cancel) {
            st.multiplexer.cancelRead(st);
            BayLog.debug("%s Reading off %s", this, st.rudder);
            st.reading = false;
        }

        st.access();

    }


    //////////////////////////////////////////////////////
    // Static methods
    //////////////////////////////////////////////////////
    static init(agtIds: number[], maxShips: number) {
        this.agentCount = agtIds.length;
        this.maxShips = maxShips;
        this.agents = new Map()

        for(const agtId of agtIds) {
            this.add(agtId, true);
        }
    }

    static get(agentId: number): GrandAgent {
        return this.agents.get(agentId)
    }

    static getByIndex(idx: number) {
        let agents = Array.from(this.agents.values())
        return agents[idx]
    }

    static add(agentId: number, anchorable: boolean) {
        if(agentId == -1)
            agentId = this.maxAgentId + 1
        //BayLog.debug("Add agent: id=%d", agentId);
        if(agentId > this.maxAgentId)
            this.maxAgentId = agentId

        // Agents run on multi core (process mode)
        let agt: GrandAgent = new GrandAgent(agentId, this.maxShips, anchorable);
        this.agents.set(agentId, agt)

        for(const lis of this.listeners) {
            lis.add(agentId)
        }
    }

    static addLifecycleListener(listener: LifeCycleListener) {
        this.listeners.push(listener)
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////


}
