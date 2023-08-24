import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {WarpDocker} from "bayserver-core/baykit/bayserver/docker/warp/warpDocker";
import {BcfElement} from "bayserver-core/baykit/bayserver/bcf/bcfElement";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {BcfKeyVal} from "bayserver-core/baykit/bayserver/bcf/bcfKeyVal";
import {FcgDockerConst} from "./fcgDockerConst";
import {GrandAgent} from "bayserver-core/baykit/bayserver/agent/grandAgent";
import {Transporter} from "bayserver-core/baykit/bayserver/agent/transporter/transporter";
import * as net from "net";
import {PlainTransporter} from "bayserver-core/baykit/bayserver/agent/transporter/plainTransporter";
import {IOUtil} from "bayserver-core/baykit/bayserver/util/ioUtil";
import {FcgPacketFactory} from "./fcgPacketFactory";
import {FcgWarpHandler_ProtocolHandlerFactory} from "./fcgWarpHandler";
import {ChannelWrapper} from "bayserver-core/baykit/bayserver/agent/channelWrapper";



export class FcgWarpDocker extends WarpDocker {

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
    // Implements WarpDocker
    ////////////////////////////////////////////////////

    isSecure(): boolean {
        return false;
    }

    ////////////////////////////////////////////////////
    // Implements WarpDocker
    ////////////////////////////////////////////////////

    protocol(): string {
        return FcgDockerConst.PROTO_NAME;
    }

    newTransporter(agt: GrandAgent, ch: ChannelWrapper): Transporter {
        return new PlainTransporter(false, IOUtil.getSockRecvBufSize(ch.socket));
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