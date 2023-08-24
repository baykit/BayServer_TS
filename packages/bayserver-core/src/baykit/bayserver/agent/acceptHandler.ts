import {GrandAgent} from "./grandAgent";
import {PortMapItem} from "./portMapItem";
import * as net from "net";
import {BayLog} from "../bayLog";
import {ChannelWrapper} from "./channelWrapper";


export class AcceptHandler {
    agent: GrandAgent;
    portMap: PortMapItem[];
    chCount = 0;
    isShutdown = false;

    constructor(agent: GrandAgent, portMap: PortMapItem[])
    {
        this.agent = agent;
        this.portMap = portMap;
    }

    onAccept(serverSkt: net.Server, clientSkt: net.Socket) : void
    {
        let portDkr = PortMapItem.findDocker(serverSkt, this.portMap);

        BayLog.debug("%s Accepted: skt=%s", this.agent, clientSkt.remoteAddress);

        try {
            portDkr.checkAdmitted(clientSkt);

            if(portDkr.isSecure()) {
                clientSkt = portDkr.getSecure().createTlsSocket(clientSkt, serverSkt)
            }
        }
        catch(e) {
            BayLog.error_e(e);
            clientSkt.end()
            return;
        }


        let ch = new ChannelWrapper(clientSkt)
        let tp = portDkr.newTransporter(this.agent, ch);
        this.agent.nonBlockingHandler.askToStart(ch)
        this.agent.nonBlockingHandler.askToRead(ch)
    }

    shutdown() {
        this.isShutdown = true
    }
}