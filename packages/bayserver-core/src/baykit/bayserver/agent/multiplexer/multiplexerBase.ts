import {Multiplexer} from "../../common/multiplexer";
import {Rudder} from "../../rudder/rudder";
import {RudderState} from "./rudderState";
import {Buffer} from "buffer";
import {GrandAgent} from "../grandAgent";
import {BayLog} from "../../bayLog";
import {WriteUnit} from "./writeUnit";
import {Transporter} from "./transporter";
import {ProtocolException} from "../../protocol/protocolException";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {IOException} from "../../util/ioException";

export abstract class MultiplexerBase implements Multiplexer {

    channelCount: number
    readonly agent: GrandAgent
    readonly rudders: Map<Object, RudderState> = new Map()

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
    abstract reqWrite(rd: Rudder, buf: Buffer, adr: string, tag: Object, listener: DataConsumeListener): void
    abstract shutdown(): void
    abstract useAsyncAPI(): boolean

    addRudderState(rd: Rudder, st: RudderState): void {
        BayLog.trace("%s add rd=%s chState=%s", this.agent, rd, st);
        st.multiplexer = this;
        this.rudders.set(rd.key(), st)
        this.channelCount++;

        st.access();
    }

    removeRudderState(rd: Rudder): void {
        this.rudders.delete(rd.key())
        this.channelCount--
    }

    checkTimeout(durationSec: number): boolean {
        return false;
    }

    closeRudder(st: RudderState): void {
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
        return this.findRudderStateByKey(rd.key())
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

    protected findRudderStateByKey(rdKey: Object): RudderState {
        return this.rudders.get(rdKey)
    }

    protected closeTimeoutSockets(): void {
        if (this.rudders.size == 0)
            return;

        let closeList = [];
        let now = Date.now();

        for (const st of this.rudders.values()) {
            if (st.transporter != null) {
                try {
                    let durationSec = Math.floor((now - st.lastAccessTime) / 1000);
                    if (st.transporter.checkTimeout(st.rudder, durationSec)) {
                        BayLog.debug("%s timed out rudder found: rd=%s", this.agent, st.rudder);
                        closeList.push(st);
                    }
                }
                catch (e) {
                    if (!(e instanceof IOException))
                        throw e;
                    else {
                        BayLog.error_e(e);
                        closeList.push(st);
                    }
                }
            }
        }
        for (const st of closeList) {
            this.reqClose(st.rudder);
        }
    }

    closeAll(): void {
        BayLog.error("closeAll")
        for (const st of this.rudders.values()) {
            /*if(st.rudder != this.agent.commandReceiver)
                this.reqClose(st.rudder);*/
        }
    }
}