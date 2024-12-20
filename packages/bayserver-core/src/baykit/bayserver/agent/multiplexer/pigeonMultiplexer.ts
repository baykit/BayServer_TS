import {TypeScriptMultiplexerBase} from "./typeScriptMultiplexerBase";
import {RudderState} from "./rudderState";
import {Rudder} from "../../rudder/rudder";
import {GrandAgent} from "../grandAgent";
import {BayLog} from "../../bayLog";
import {Sink} from "../../sink";


export class PigeonMultiplexer extends TypeScriptMultiplexerBase {

    constructor(agt: GrandAgent, anchorable: boolean) {
        super(agt, anchorable);
    }

    toString() {
        return "PigeonMpx[" + this.agent + "]";
    }

    reqAccept(rd: Rudder): void {
        throw new Sink()
    }

    reqConnect(rd: Rudder, addr: string, port: number): void {
        throw new Sink()
    }

    reqRead(rd: Rudder): void {
        let st = this.getRudderState(rd)
        if(st == null) {
            BayLog.warn("%s rudder state not found: rd=%s", this.agent, rd)
            return
        }
        BayLog.debug("%s reqRead rd=%s st=%s", this.agent, rd, st);

        this.nextRead(st)
        st.access()
    }

    nextRead(st: RudderState): void {
        BayLog.debug("%s next read", this)
        st.rudder.reqRead(st.readBuf)
    }


    cancelRead(st: RudderState) {
    }
}