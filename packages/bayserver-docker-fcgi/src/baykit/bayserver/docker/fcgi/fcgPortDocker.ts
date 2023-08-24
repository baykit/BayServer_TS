import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {PortBase} from "bayserver-core/baykit/bayserver/docker/base/portBase";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {FcgDockerConst} from "./fcgDockerConst";
import {FcgPacketFactory} from "./fcgPacketFactory";
import {FcgInboundHandler_ProtocolHandlerFactory} from "./fcgInboundHandler";


export class FcgPortDocker extends PortBase {

    ////////////////////////////////////////////////////
    // Implements Port
    ////////////////////////////////////////////////////

    protocol(): string {
        return FcgDockerConst.PROTO_NAME
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
    FcgDockerConst.PROTO_NAME,
    new FcgPacketFactory()
);

ProtocolHandlerStore.registerProtocol(
    FcgDockerConst.PROTO_NAME,
    true,
    new FcgInboundHandler_ProtocolHandlerFactory()
)

module.exports = {
    createDocker: (): Docker => new FcgPortDocker()
}