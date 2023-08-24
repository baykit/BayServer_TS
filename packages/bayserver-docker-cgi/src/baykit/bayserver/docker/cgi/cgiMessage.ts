import {Message} from "bayserver-core/baykit/bayserver/util/message";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {Locale} from "bayserver-core/baykit/bayserver/util/locale";

export class CGIMessage extends Message {
    static msg: CGIMessage

    static init(): void {
        this.msg = new CGIMessage();
        this.msg.init(BayServer.bservLib + "/conf/cgi_messages", Locale.getDefault());
    }

    static get(key: string, ...args: Object[]): string {
        return this.msg.get(key, ...args)
    }
}