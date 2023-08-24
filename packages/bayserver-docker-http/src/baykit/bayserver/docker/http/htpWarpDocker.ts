import {WarpDocker} from "bayserver-core/baykit/bayserver/docker/warp/warpDocker";
import {GrandAgent} from "bayserver-core/baykit/bayserver/agent/grandAgent";
import {Transporter} from "bayserver-core/baykit/bayserver/agent/transporter/transporter";
import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {BcfElement} from "bayserver-core/baykit/bayserver/bcf/bcfElement";
import {BcfKeyVal} from "bayserver-core/baykit/bayserver/bcf/bcfKeyVal";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {HtpDockerConst} from "./htpDockerConst";
import {SecureTransporter} from "bayserver-core/baykit/bayserver/agent/transporter/secureTransporter";
import {IOUtil} from "bayserver-core/baykit/bayserver/util/ioUtil";
import {PlainTransporter} from "bayserver-core/baykit/bayserver/agent/transporter/plainTransporter";
import {PacketStore} from "bayserver-core/baykit/bayserver/protocol/packetStore";
import {H1PacketFactory} from "./h1/h1PacketFactory";
import {H2PacketFactory} from "./h2/h2PacketFactory";
import {ProtocolHandlerStore} from "bayserver-core/baykit/bayserver/protocol/protocolHandlerStore";
import {H1WarpHandler_ProtocolHandlerFactory} from "./h1/h1WarpHandler";
import {ChannelWrapper} from "bayserver-core/baykit/bayserver/agent/channelWrapper";


export class HtpWarpDocker extends WarpDocker {

    static readonly DEFAULT_SSL_PROTOCOL: string = "TLS";

    secure: boolean
    supportH2: boolean = true
    traceSSL: boolean = false
    sslCtx: object = {}

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        if(this.secure) {
            this.sslCtx = {
                enableTrace: this.traceSSL,
                isServer: false,
            }
        }
    }

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "supporth2":
                this.supportH2 = StrUtil.parseBool(kv.value);
                break;

            case "tracessl":
                this.traceSSL = StrUtil.parseBool(kv.value)
                break

            case "secure":
                this.secure = StrUtil.parseBool(kv.value);
                break;
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements WarpDocker
    //////////////////////////////////////////////////////
    isSecure(): boolean {
        return this.secure;
    }

    //////////////////////////////////////////////////////
    // Implements WarpDockerBase
    //////////////////////////////////////////////////////

    protocol(): string {
        return HtpDockerConst.H1_PROTO_NAME;
    }

    newTransporter(agt: GrandAgent, ch: ChannelWrapper): Transporter {
        if(this.secure) {
            return new SecureTransporter(this.sslCtx, false, true);
        }
        else
            return new PlainTransporter(false, IOUtil.getSockRecvBufSize(ch.socket));
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
    false,
    new H1WarpHandler_ProtocolHandlerFactory()
);
/*ProtocolHandlerStore.registerProtocol(
    HtpDockerConst.H2_PROTO_NAME,
    false,
    new H2WarpHandler.WarpProtocolHandlerFactory());
*/

module.exports = {
    createDocker: (): Docker => new HtpWarpDocker()
}