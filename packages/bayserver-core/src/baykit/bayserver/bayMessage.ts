import { Locale } from "./util/locale";
import {Message} from "./util/message";

export class BayMessage {

    static msg : Message = new Message()

    public static init(confName: string, locale: Locale) {
        this.msg.init(confName, locale)
    }

    public static get(key: string, ...args: any[]) : string{
        return BayMessage.msg.get(key, ...args);
    }
}