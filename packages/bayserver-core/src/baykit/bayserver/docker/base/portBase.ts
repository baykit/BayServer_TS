import {DockerBase} from "./dockerBase";
import {Port} from "../port";
import {Permission} from "../permission";
import {Secure} from "../Secure";
import {City} from "../city";
import {GrandAgent} from "../../agent/grandAgent";
import {Transporter} from "../../agent/transporter/transporter";
import {ProtocolHandler} from "../../protocol/protocolHandler";
import {InboundShip} from "./inboundShip";
import {Docker} from "../docker";
import {InboundShipStore} from "./inboundShipStore";
import {IOUtil} from "../../util/ioUtil";
import * as net from "net";
import {PlainTransporter} from "../../agent/transporter/plainTransporter";
import {ProtocolHandlerStore} from "../../protocol/protocolHandlerStore";
import {InboundDataListener} from "./inboundDataListener";
import {Cities} from "../../util/cities";
import {BcfElement} from "../../bcf/bcfElement";
import {StrUtil} from "../../util/strUtil";
import {ConfigException} from "../../configException";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {SysUtil} from "../../util/sysUtil";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {ChannelWrapper} from "../../agent/channelWrapper";
import {BayLog} from "../../bayLog";
export abstract class PortBase extends DockerBase implements Port, Docker {

    permissionList: Permission[] = [];
    host: string = null;
    port: number;
    socketPath: string;
    timeoutSec = -1; // -1 means "Use socketTimeout of Harbor docker"
    secureDocker: Secure;
    anchored: boolean = true;
    additionalHeaders: string[][] = [];
    cities: Cities = new Cities();

    getType(): string {
        return "port"
    }

    //////////////////////////////////////////////////////
    // Abstract methods
    //////////////////////////////////////////////////////

    abstract supportAnchored(): boolean;
    abstract supportUnanchored(): boolean;

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        if(StrUtil.empty(elm.arg))
            throw new ConfigException(
                elm.fileName,
                elm.lineNo,
                BayMessage.get(Symbol.CFG_INVALID_PORT_NAME, elm.name));

        super.init(elm, parent);

        let portName = elm.arg.toLowerCase();
        if(portName.startsWith(":unix:")) {
            // unix domain sokcet
            if(!SysUtil.supportUnixDomainSocketAddress()) {
                throw new ConfigException(
                    elm.fileName,
                    elm.lineNo,
                    BayMessage.get(Symbol.CFG_CANNOT_SUPPORT_UNIX_DOMAIN_SOCKET));
            }
            this.port = -1;
            this.socketPath = elm.arg.substring(6);
            this.host = elm.arg;
        }
        else {
            // TCP or UDP port
            let hostPort: string;
            if(portName.startsWith(":tcp:")) {
                // tcp server socket
                this.anchored = true;
                hostPort = elm.arg.substring(5);
            }
            else if(portName.startsWith(":udp:")) {
                // udp server socket
                this.anchored = false;
                hostPort = elm.arg.substring(5);
            }
            else {
                // default: tcp server socket
                this.anchored = true;
                hostPort = elm.arg;
            }
            let idx = hostPort.indexOf(':');

            try {
                if (idx >= 0) {
                    this.host = hostPort.substring(0, idx);
                    this.port = Number.parseInt(hostPort.substring(idx + 1));
                }
                else {
                    this.host = null;
                    this.port = Number.parseInt(hostPort);
                }
            }
            catch(e) {
                throw new ConfigException(
                    elm.fileName,
                    elm.lineNo,
                    BayMessage.get(Symbol.CFG_INVALID_PORT_NAME, elm.arg));
            }
        }

        // TCP/UDP support check
        if(this.anchored) {
            if (!this.supportAnchored())
                throw new ConfigException(
                    elm.fileName,
                    elm.lineNo,
                    BayMessage.get(Symbol.CFG_TCP_NOT_SUPPORTED));
        }
        else {
            if (!this.supportUnanchored())
                throw new ConfigException(
                    elm.fileName,
                    elm.lineNo,
                    BayMessage.get(Symbol.CFG_UDP_NOT_SUPPORTED));
        }
    }

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initDocker(dkr: Docker): boolean {
        switch(dkr.getType()) {
            case "permission":
                this.permissionList.push(dkr as Object as Permission);
                break

            case "city":
                this.cities.add(dkr as Object as City);
                break

            case "secure":
                this.secureDocker = dkr as Object as Secure;
                break

            default:
                return false;
        }
        return true;
    }

    initKeyVal(kv: BcfKeyVal): boolean {
        switch(kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "timeout":
                this.timeoutSec = Number.parseInt(kv.value);
                break;

            case "addheader": {
                let idx = kv.value.indexOf(':');
                if (idx < 0) {
                    throw new ConfigException(
                        kv.fileName,
                        kv.lineNo,
                        BayMessage.get(Symbol.CFG_INVALID_PARAMETER_VALUE, kv.value));
                }
                let name = kv.value.substring(0, idx).trim();
                let value = kv.value.substring(idx + 1).trim();
                this.additionalHeaders.push([name, value]);
                break;
            }
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements Port
    //////////////////////////////////////////////////////

    getHost(): string {
        return this.host;
    }

    getPort(): number {
        return this.port;
    }

    abstract protocol(): string;

    getSocketPath(): string {
        return this.socketPath;
    }

    getAddress(): string {
        return "";
    }

    isAnchored(): boolean {
        return this.anchored;
    }

    getTimeoutSec(): number {
        return this.timeoutSec;
    }

    isSecure(): boolean {
        return this.secureDocker != null;
    }


    getAdditionalHeaders(): string[][]{
        return this.additionalHeaders;
    }

    checkAdmitted(ch: net.Socket) {
        for(const p of this.permissionList)
            p.socketAdmitted(ch)
    }

    getCities(): City[] {
        return this.cities.getCities()
    }

    findCity(name: string): City {
        return undefined;
    }


    newTransporter(agent: GrandAgent, ch: ChannelWrapper): Transporter {
        let sip: InboundShip = PortBase.getShipStore(agent).rent();
        var tp: Transporter;
        if(this.isSecure())
            tp = this.secureDocker.createTransporter();
        else
            tp = new PlainTransporter(true, IOUtil.getSockRecvBufSize(ch.socket));

        let protoHnd: ProtocolHandler<any, any> =
            PortBase.getProtocolHandlerStore(this.protocol(), agent).rent();
        sip.initInbound(ch, agent, tp, this, protoHnd);
        tp.init(agent.nonBlockingHandler, ch, new InboundDataListener(sip));
        return tp;
    }

    returnProtocolHandler(agt: GrandAgent, protoHnd: ProtocolHandler<any, any>) {
        BayLog.debug("%s Return protocol handler: ", protoHnd);
        PortBase.getProtocolHandlerStore(protoHnd.protocol(), agt).Return(protoHnd);
    }

    returnShip(sip: InboundShip) {
        BayLog.debug("%s Return ship: ", sip);
        PortBase.getShipStore(sip.agent).Return(sip);
    }

    createServer(): net.Server {
        if(this.isSecure())
            return this.secureDocker.createServer()
        else
            return new net.Server()
    }

    getSecure(): Secure {
        return this.secureDocker;
    }

    //////////////////////////////////////////////////////
    // class methods
    //////////////////////////////////////////////////////
    static getShipStore(agt: GrandAgent) {
        return InboundShipStore.getStore(agt.agentId);
    }

    static getProtocolHandlerStore(protocol: string, agt: GrandAgent): ProtocolHandlerStore<any, any> {
        return ProtocolHandlerStore.getStore(protocol, true, agt.agentId);
    }
}