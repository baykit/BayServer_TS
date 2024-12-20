import {TypeScriptMultiplexerBase} from "./typeScriptMultiplexerBase";
import {RudderState} from "./rudderState";
import {Rudder} from "../../rudder/rudder";
import {GrandAgent} from "../grandAgent";
import {BayLog} from "../../bayLog";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {IOException} from "../../util/ioException";
import {ServerRudder} from "../../rudder/serverRudder";
import {Socket} from "net";
import {SocketRudder} from "../../rudder/socketRudder";
import {WriteUnit} from "./writeUnit";
import {Buffer} from "buffer";
import {ReadableRudder} from "../../rudder/readableRudder";
import {Sink} from "../../sink";


export class ValveMultiplexer extends TypeScriptMultiplexerBase {

    constructor(agt: GrandAgent, anchorable: boolean) {
        super(agt, anchorable);
    }

    toString() {
        return "ValveMpx[" + this.agent + "]";
    }

    reqAccept(rd: Rudder): void {
        BayLog.debug("%s reqAccept rd=%s aborted=%s", this.agent, rd, this.agent.aborted);
        if (this.agent.aborted) {
            return;
        }

        let st = this.getRudderState(rd)
        if(st == null) {
            BayLog.warn("%s rudder state not found: rd=%s", this.agent, rd)
            return
        }

        this.nextAccept(st)
        st.access()
    }

    reqConnect(rd: Rudder, addr: string, port: number): void {
        BayLog.debug("%s askToConnect addr=%s port=%d", this.agent, addr, port);
        let st = this.getRudderState(rd)
        if(st == null) {
            BayLog.warn("%s rudder state not found: rd=%s", this.agent, rd)
            return
        }

        let callback = () => {
            this.agent.sendConnectedLetter(st, true);
        }

        let socket = (rd as SocketRudder).socket()
        if(port == 0) {
            // UNIX domain socket
            socket.connect(addr, callback)
        }
        else {
            socket.connect(port, addr, callback)
        }

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
        let readable = (st.rudder as ReadableRudder).readable
        readable.resume()
    }


    cancelRead(st: RudderState) {
        (st.rudder as ReadableRudder).pause()
    }
}