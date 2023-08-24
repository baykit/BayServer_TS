import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {PortBase} from "bayserver-core/baykit/bayserver/docker/base/portBase";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {AjpPacketFactory} from "./ajpPacketFactory";
import {AjpDockerConst} from "./ajpDockerConst";
import {AjpInboundHandler_ProtocolHandlerFactory} from "./ajpInboundHandler";

export class AjpPortDocker extends PortBase {

    ////////////////////////////////////////////////////
    // Implements Port
    ////////////////////////////////////////////////////

    protocol(): string {
        return AjpDockerConst.PROTO_NAME
    }

    ////////////////////////////////////////////////////
    // Implements PortBase
    ////////////////////////////////////////////////////

    supportAnchored(): boolean {
        return true;
    }

    supportUnanchored(): boolean {
        return false;
    }
}

PacketStore.registerProtocol(
    AjpDockerConst.PROTO_NAME,
    new AjpPacketFactory()
);

ProtocolHandlerStore.registerProtocol(
    AjpDockerConst.PROTO_NAME,
    true,
    new AjpInboundHandler_ProtocolHandlerFactory()
)

module.exports = {
    createDocker: (): Docker => new AjpPortDocker()
}