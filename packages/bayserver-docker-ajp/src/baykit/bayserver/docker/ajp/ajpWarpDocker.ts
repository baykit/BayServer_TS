import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {AjpPacketFactory} from "./ajpPacketFactory";
import {AjpDockerConst} from "./ajpDockerConst";
import {WarpDocker} from "bayserver-core/baykit/bayserver/docker/warp/warpDocker";
import {GrandAgent} from "bayserver-core/baykit/bayserver/agent/grandAgent";
import * as net from "net";
import {Transporter} from "bayserver-core/baykit/bayserver/agent/transporter/transporter";
import {PlainTransporter} from "bayserver-core/baykit/bayserver/agent/transporter/plainTransporter";
import {IOUtil} from "bayserver-core/baykit/bayserver/util/ioUtil";
import {AjpWarpHandler_ProtocolHandlerFactory} from "./ajpWarpHandler";
import {ChannelWrapper} from "bayserver-core/baykit/bayserver/agent/channelWrapper";


export class AjpWarpDocker extends WarpDocker {

    ////////////////////////////////////////////////////
    // Implements WarpDocker
    ////////////////////////////////////////////////////

    isSecure(): boolean {
        return false;
    }

    ////////////////////////////////////////////////////
    // Implements WarpDocker
    ////////////////////////////////////////////////////

    protocol(): string {
        return AjpDockerConst.PROTO_NAME;
    }

    newTransporter(agt: GrandAgent, ch: ChannelWrapper): Transporter {
        return new PlainTransporter(false, IOUtil.getSockRecvBufSize(ch.socket));
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