import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {Locale} from "bayserver-core/baykit/bayserver/util/locale";
import {Message} from "bayserver-core/baykit/bayserver/util/message";

export class H2ErrorCode extends Message{
    static readonly NO_ERROR = 0x0;
    static readonly PROTOCOL_ERROR = 0x1;
    static readonly INTERNAL_ERROR = 0x2;
    static readonly FLOW_CONTROL_ERROR = 0x3;
    static readonly SETTINGS_TIMEOUT = 0x4;
    static readonly STREAM_CLOSED = 0x5;
    static readonly FRAME_SIZE_ERROR = 0x6;
    static readonly REFUSED_STREAM = 0x7;
    static readonly CANCEL = 0x8;
    static readonly COMPRESSION_ERROR = 0x9;
    static readonly CONNECT_ERROR = 0xa;
    static readonly ENHANCE_YOUR_CALM = 0xb;
    static readonly INADEQUATE_SECURITY = 0xc;
    static readonly HTTP_1_1_REQUIRED = 0xd;

    static msg: Message = null

    static init(): void {
        if(this.msg != null)
            return

        let prefix = BayServer.bservLib + "/conf/h2_messages";
        this.msg = new H2ErrorCode();
        this.msg.init(prefix, Locale.getDefault());
    }
}