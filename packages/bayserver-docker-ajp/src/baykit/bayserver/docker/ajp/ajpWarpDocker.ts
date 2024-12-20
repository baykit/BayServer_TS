import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {AjpPacketFactory} from "./ajpPacketFactory";
import {AjpDockerConst} from "./ajpDockerConst";
import {GrandAgent} from "bayserver-core/baykit/bayserver/agent/grandAgent";
import {IOUtil} from "bayserver-core/baykit/bayserver/util/ioUtil";
import {AjpWarpHandler_ProtocolHandlerFactory} from "./ajpWarpHandler";
import {Rudder} from "bayserver-core/baykit/bayserver/rudder/rudder";
import {SocketRudder} from "bayserver-core/baykit/bayserver/rudder/socketRudder";
import {Socket} from "net";
import {WarpBase} from "bayserver-core/baykit/bayserver/docker/base/warpBase";
import {PlainTransporter} from "bayserver-core/baykit/bayserver/agent/multiplexer/plainTransporter";
import {Transporter} from "bayserver-core/baykit/bayserver/agent/multiplexer/transporter";
import {Ship} from "bayserver-core/baykit/bayserver/ship/ship";


export class AjpWarpDocker extends WarpBase {

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
        return AjpDockerConst.PROTO_NAME;
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
    AjpDockerConst.PROTO_NAME,
    new AjpPacketFactory()
);

ProtocolHandlerStore.registerProtocol(
    AjpDockerConst.PROTO_NAME,
    false,
    new AjpWarpHandler_ProtocolHandlerFactory()
);

module.exports = {
    createDocker: (): Docker => new AjpWarpDocker()
}