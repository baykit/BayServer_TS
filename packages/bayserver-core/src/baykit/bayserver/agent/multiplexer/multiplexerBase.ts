import {Multiplexer} from "../../common/multiplexer";
import {Rudder} from "../../rudder/rudder";
import {RudderState} from "../../common/rudderState";
import {Buffer} from "buffer";
import {GrandAgent} from "../grandAgent";
import {BayLog} from "../../bayLog";
import {WriteUnit} from "../../common/writeUnit";
import {Transporter} from "../../common/transporter";
import {ProtocolException} from "../../protocol/protocolException";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {IOException} from "../../util/ioException";

export abstract class MultiplexerBase implements Multiplexer {

    channelCount: number
    readonly agent: GrandAgent
    readonly rudders: Set<Rudder> = new Set()

    protected constructor(agt: GrandAgent) {
        this.agent = agt
    }

    toString(): string {
        return this.agent.toString()
    }

    //////////////////////////////////////////////////////
    // Implements Multiplexer
    //////////////////////////////////////////////////////

    abstract cancelRead(st: RudderState);
    abstract cancelWrite(st: RudderState);
    abstract nextAccept(st: RudderState): void
    abstract nextRead(st: RudderState): void
    abstract nextWrite(st: RudderState): void
    abstract onBusy(): void
    abstract onFree(): void
    abstract reqAccept(rd: Rudder): void
    abstract reqClose(rd: Rudder): void
    abstract reqConnect(rd: Rudder, addr: string, port: number): void
    abstract reqRead(rd: Rudder): void
    abstract reqWrite(rd: Rudder, buf: Buffer, adr: string, tag: Object, flush: boolean, listener: DataConsumeListener): void
    abstract reqTransfer(rd: Rudder, fileRd: Rudder, ofs: number, len: number, listener: DataConsumeListener): void
    abstract shutdown(): void
    abstract useAsyncAPI(): boolean

    addRudderState(rd: Rudder, st: RudderState): void {
        BayLog.trace("%s add rd=%s chState=%s", this.agent, rd, st);
        st.multiplexer = this;
        rd.state = st
        this.rudders.add(rd)
        this.channelCount++;

        st.access();
    }

    removeRudderState(rd: Rudder): void {
        rd.state = null
        this.rudders.delete(rd)
        this.channelCount--
    }

    checkTimeout(durationSec: number): boolean {
        return false;
    }

    closeRudder(rd: Rudder): void {
        BayLog.debug("%s closeRd %s", this.agent, rd)

        try {
            BayLog.trace("%s OS Close", this.agent)
            rd.reqClose()
        }
        catch(e) {
            if(e instanceof IOException)
                BayLog.warn("%s OS Close Error: %s", this.agent, e)
            else
                throw e
        }
    }

    consumeOldestUnit(st: RudderState): boolean {
        let u: WriteUnit = null

        if (st.writeQueue.length == 0) {
            return false
        }
        u = st.writeQueue.shift()
        u.done()
        return true;
    }

    getRudderState(rd: Rudder): RudderState {
        return rd.state as RudderState
    }

    getTransporter(rd: Rudder): Transporter {
        return this.getRudderState(rd).transporter
    }

    isBusy(): boolean {
        return this.channelCount >= this.agent.maxInboundShips
    }

    isNonBlocking(): boolean {
        return false;
    }

    //////////////////////////////////////////////////////
    // Implements Multiplexer
    //////////////////////////////////////////////////////

    protected closeTimeoutSockets(): void {
        if (this.rudders.size == 0)
            return;

        let now = Date.now();

        for (const rd of Array.from(this.rudders)) {
            if (rd.closed()) {
                this.rudders.delete(rd)
                continue
            }
            let st = rd.state as RudderState
            if (st.transporter != null) {
                try {
                    let durationSec = Math.floor((now - st.lastAccessTime) / 1000);
                    if (st.transporter.checkTimeout(rd, durationSec)) {
                        BayLog.debug("%s timed out rudder found: rd=%s", this.agent, rd);
                        this.reqClose(rd);
                        this.rudders.delete(rd);
                    }
                }
                catch (e) {
                    if (!(e instanceof IOException))
                        throw e;
                    else {
                        BayLog.error_e(e);
                        this.reqClose(rd);
                        this.rudders.delete(rd);
                    }
                }
            }
        }
    }

    closeAll(): void {
        BayLog.error("closeAll")
        for (const rd of Array.from(this.rudders)) {
            /*if(rd != this.agent.commandReceiver)
                this.reqClose(rd);*/
        }
    }
}