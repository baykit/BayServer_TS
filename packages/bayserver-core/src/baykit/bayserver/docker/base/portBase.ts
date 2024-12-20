import {DockerBase} from "./dockerBase";
import {Port} from "../port";
import {Permission} from "../permission";
import {Secure} from "../Secure";
import {City} from "../city";
import {GrandAgent} from "../../agent/grandAgent";
import {ProtocolHandler} from "../../protocol/protocolHandler";
import {InboundShip} from "../../common/inboundShip";
import {Docker} from "../docker";
import {InboundShipStore} from "../../common/inboundShipStore";
import {IOUtil} from "../../util/ioUtil";
import * as net from "net";
import {PlainTransporter} from "../../agent/multiplexer/plainTransporter";
import {ProtocolHandlerStore} from "../../protocol/protocolHandlerStore";
import {Cities} from "../../util/cities";
import {BcfElement} from "../../bcf/bcfElement";
import {StrUtil} from "../../util/strUtil";
import {ConfigException} from "../../configException";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {SysUtil} from "../../util/sysUtil";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {BayLog} from "../../bayLog";
import {Rudder} from "../../rudder/rudder";
import {Transporter} from "../../agent/multiplexer/transporter";
import {SocketRudder} from "../../rudder/socketRudder";
import {RudderState} from "../../agent/multiplexer/rudderState";
import {Socket} from "net";
import {ServerRudder} from "../../rudder/serverRudder";
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

    checkAdmitted(rd: Rudder) {
        for(const p of this.permissionList)
            p.socketAdmitted(rd)
    }

    getCities(): City[] {
        return this.cities.getCities()
    }

    findCity(name: string): City {
        return undefined;
    }


    onConnected(agtId: number, clientRd: Rudder, serverRd: Rudder): Transporter {
        this.checkAdmitted(clientRd)

        let sip: InboundShip = PortBase.getShipStore(agtId).rent();
        let agt = GrandAgent.get(agtId)

        let clientSkt = (clientRd as SocketRudder).socket();
        let serverSkt = (serverRd as ServerRudder).server;

        var tp: Transporter;
        if(this.isSecure()) {
            tp = this.secureDocker.newTransporter(agtId, sip);
            let sslSkt = this.getSecure().createTlsSocket(clientSkt, serverSkt);
            clientRd = new SocketRudder(sslSkt)
        }
        else {
            tp = new PlainTransporter(
                agt.netMultiplexer,
                sip,
                true,
                IOUtil.getSockRecvBufSize(clientSkt),
                false);
        }

        let protoHnd: ProtocolHandler<any, any> =
            PortBase.getProtocolHandlerStore(this.protocol(), agtId).rent();
        sip.initInbound(clientRd, agtId, tp, this, protoHnd);
        tp.init()

        let st = new RudderState(clientRd, tp)
        agt.netMultiplexer.addRudderState(clientRd, st)
        agt.netMultiplexer.reqRead(clientRd)
        return tp;
    }

    returnProtocolHandler(agtId: number, protoHnd: ProtocolHandler<any, any>) {
        BayLog.debug("%s Return protocol handler: ", protoHnd);
        PortBase.getProtocolHandlerStore(protoHnd.protocol(), agtId).Return(protoHnd);
    }

    returnShip(sip: InboundShip) {
        BayLog.debug("%s Return ship: ", sip);
        PortBase.getShipStore(sip.agentId).Return(sip);
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
    static getShipStore(agtId: number) {
        return InboundShipStore.getStore(agtId);
    }

    static getProtocolHandlerStore(protocol: string, agtId: number): ProtocolHandlerStore<any, any> {
        return ProtocolHandlerStore.getStore(protocol, true, agtId);
    }
}