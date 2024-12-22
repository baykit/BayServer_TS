import {MultiplexerBase} from "./multiplexerBase";
import {TimerHandler} from "../timerHandler";
import {GrandAgent} from "../grandAgent";
import {BayServer} from "../../bayserver";
import {Rudder} from "../../rudder/rudder";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {BayLog} from "../../bayLog";
import {IOException} from "../../util/ioException";
import {WriteUnit} from "./writeUnit";
import {RudderState} from "./rudderState";
import {ServerRudder} from "../../rudder/serverRudder";
import {Socket} from "net";
import {SocketRudder} from "../../rudder/socketRudder";
import {Sink} from "../../sink";

export abstract class TypeScriptMultiplexerBase extends MultiplexerBase implements TimerHandler {

    protected constructor(agt: GrandAgent, anchorable: boolean) {
        super(agt);
        if(!anchorable) {
            throw new Sink()
        }

        agt.addTimerHandler(this)
    }

    //////////////////////////////////////////////////////
    // Implements Multiplexer
    //////////////////////////////////////////////////////

    addRudderState(rd: Rudder, st: RudderState): void {
        super.addRudderState(rd, st)

        st.rudder.registerReadHandler((buf, n) => {
            BayLog.debug("%s read %d bytes", this, n)
            st.readBuf = buf
            this.agent.sendReadLetter(st, n, null, true);
        })

        st.rudder.registerWriteHandler(n => {
            this.agent.sendWroteLetter(st, n, true);
        })

        st.rudder.registerErrorHandler(e => {
            BayLog.error_e(e, "%s Read error: %s", this, e)
            this.agent.sendErrorLetter(st, new IOException(e.message), true);
        })

        st.rudder.registerCloseHandler(() => {
            BayLog.debug("%s closed: rd=%s", this, st.rudder)
            this.agent.sendClosedLetter(st, true)
        })

        if (st.rudder instanceof ServerRudder) {
            let sktRd: ServerRudder = st.rudder
            sktRd.server.on('connection',  (socket: Socket) => {
                this.agent.sendAcceptedLetter(st, new SocketRudder(socket), true)
            });
        }
    }

    reqWrite(rd: Rudder, buf: Buffer, adr: string, tag: Object, listener: DataConsumeListener): void {
        let st = this.getRudderState(rd)
        BayLog.debug("%s reqWrite: rd=%s st=%s len=%d", this.agent, rd, st, buf.length);
        if(st == null || st.closing) {
            BayLog.warn("%s Rudder is closed: %s", this.agent, rd)
            listener()
            return
        }

        let unt = new WriteUnit(buf, adr, tag, listener)
        st.writeQueue.push(unt)

        let needWrite = false
        if(!st.writing) {
            needWrite = true
            st.writing = true
        }

        if(needWrite)
            this.nextWrite(st)
        st.access()
    }

    reqClose(rd: Rudder): void {
        let st = this.getRudderState(rd)
        BayLog.debug("%s reqClose st=%s", this.agent, st);

        if(st == null || st.closed) {
            BayLog.warn("%s Rudder is closed: %s", this.agent, rd)
            return
        }

        st.rudder.reqClose()
    }

    nextWrite(st: RudderState): void {
        let unit = st.writeQueue[0]
        BayLog.debug("%s Try to write: pkt=%s buflen=%d closed=%b", this, unit.tag, unit.buf.length, st.closed);

        try {
            st.rudder.reqWrite(unit.buf)
        }
        catch(e) {
            BayLog.debug_e(e, "%s Error on write: %s", this, e.message)
            throw new IOException(e.message)
        }
    }

    nextAccept(st: RudderState): void {

    }

    cancelWrite(st: RudderState) {
    }

    shutdown() {
        this.closeAll()
    }

    onFree() {
        if(this.agent.aborted)
            return;

        for (const rd of BayServer.anchorablePortMap.keys()) {
            this.reqAccept(rd);
        }
    }

    isNonBlocking(): boolean {
        return false
    }

    onBusy(): void {
    }

    useAsyncAPI(): boolean {
        return false;
    }

    //////////////////////////////////////////////////////
    // Implements TimerHandler
    //////////////////////////////////////////////////////
    onTimer(): void {
        this.closeTimeoutSockets()
    }


}