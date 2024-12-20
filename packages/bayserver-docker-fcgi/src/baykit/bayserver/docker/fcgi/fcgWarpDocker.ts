import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {BcfElement} from "bayserver-core/baykit/bayserver/bcf/bcfElement";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {BcfKeyVal} from "bayserver-core/baykit/bayserver/bcf/bcfKeyVal";
import {FcgDockerConst} from "./fcgDockerConst";
import {GrandAgent} from "bayserver-core/baykit/bayserver/agent/grandAgent";
import {PlainTransporter} from "bayserver-core/baykit/bayserver/agent/multiplexer/plainTransporter";
import {IOUtil} from "bayserver-core/baykit/bayserver/util/ioUtil";
import {FcgPacketFactory} from "./fcgPacketFactory";
import {FcgWarpHandler_ProtocolHandlerFactory} from "./fcgWarpHandler";
import {WarpBase} from "bayserver-core/baykit/bayserver/docker/base/warpBase";
import {Rudder} from "bayserver-core/baykit/bayserver/rudder/rudder";
import {Ship} from "bayserver-core/baykit/bayserver/ship/ship";
import {Transporter} from "bayserver-core/baykit/bayserver/agent/multiplexer/transporter";
import {SocketRudder} from "bayserver-core/baykit/bayserver/rudder/socketRudder";
import {Socket} from "net";



export class FcgWarpDocker extends WarpBase {

    scriptBase: string
    docRoot: string

    ////////////////////////////////////////////////////
    // Implements Docker
    ////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        if (this.scriptBase == null)
            BayLog.warn("docRoot is not specified");
    }

    initKeyVal(kv: BcfKeyVal): boolean {
        switch(kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "scriptbase":
                this.scriptBase = kv.value;
                break;

            case "docroot":
                this.docRoot = kv.value;
                break;
        }
        return true;
    }

    ////////////////////////////////////////////////////
    // Implements WarpBase
    ////////////////////////////////////////////////////

    isSecure(): boolean {
        return false;
    }

    ////////////////////////////////////////////////////
    // Implements WarpBase
    ////////////////////////////////////////////////////

    protocol(): string {
        return FcgDockerConst.PROTO_NAME;
    }

    newTransporter(agt: GrandAgent, rd: Rudder, sip: Ship): Transporter {
        return new PlainTransporter(
            agt.netMultiplexer,
            sip,
            false,
            IOUtil.getSockRecvBufSize((rd as SocketRudder).socket()),
            false)
    }
}

PacketStore.registerProtocol(
    FcgDockerConst.PROTO_NAME,
    new FcgPacketFactory()
);

ProtocolHandlerStore.registerProtocol(
    FcgDockerConst.PROTO_NAME,
    false,
    new FcgWarpHandler_ProtocolHandlerFactory()
);

module.exports = {
    createDocker: (): Docker => new FcgWarpDocker()
}