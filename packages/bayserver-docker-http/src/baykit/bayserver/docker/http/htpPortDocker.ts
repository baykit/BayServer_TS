import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {PortBase} from "bayserver-core/baykit/bayserver/docker/base/portBase";
import {BcfElement} from "bayserver-core/baykit/bayserver/bcf/bcfElement";
import {HtpDockerConst} from "./htpDockerConst";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {H1PacketFactory} from "./h1/h1PacketFactory";
import {H1InboundProtocolHandlerFactory} from "./h1/h1InboundHandler";
import {BcfKeyVal} from "bayserver-core/baykit/bayserver/bcf/bcfKeyVal";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {H2ErrorCode} from "./h2/h2ErrorCode";
import {H2InboundProtocolHandlerFactory} from "./h2/h2InboundHandler";
import {H2PacketFactory} from "./h2/h2PacketFactory";

export class HtpPortDocker extends PortBase {

    static readonly DEFAULT_SUPPORT_HTTP2: boolean  = true;
    supportH2: boolean = HtpPortDocker.DEFAULT_SUPPORT_HTTP2;

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(ini: BcfElement, parent: Docker) {
        super.init(ini, parent)

        if(this.supportH2) {
            if(this.isSecure())
                this.secureDocker.setAppProtocols(["h2", "http/1.1"]);
            H2ErrorCode.init();
        }
    }

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initKeyVal(kv: BcfKeyVal): boolean {
        switch(kv.key.toLowerCase()) {
            case "supporth2":
            case "enableh2":
                this.supportH2 = StrUtil.parseBool(kv.value);
                break;

            default:
                return super.initKeyVal(kv);
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements Port
    //////////////////////////////////////////////////////
    protocol(): string {
        return HtpDockerConst.H1_PROTO_NAME;
    }

    //////////////////////////////////////////////////////
    // Implements PortBase
    //////////////////////////////////////////////////////
    supportAnchored(): boolean {
        return true;
    }

    supportUnanchored(): boolean {
        return false;
    }
}

PacketStore.registerProtocol(
    HtpDockerConst.H1_PROTO_NAME,
    new H1PacketFactory()
);

PacketStore.registerProtocol(
    HtpDockerConst.H2_PROTO_NAME,
    new H2PacketFactory()
);

ProtocolHandlerStore.registerProtocol(
    HtpDockerConst.H1_PROTO_NAME,
    true,
    new H1InboundProtocolHandlerFactory());

ProtocolHandlerStore.registerProtocol(
    HtpDockerConst.H2_PROTO_NAME,
    true,
    new H2InboundProtocolHandlerFactory());


module.exports = {
    createDocker: (): Docker => new HtpPortDocker()
}