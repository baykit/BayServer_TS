import { Locale } from "./locale"
import { StrUtil } from "./strUtil"
import { BayLog } from "../bayLog";
import { BcfParser } from "../bcf/bcfParser";
import { BcfDocument } from "../bcf/bcfDocument";
import { BcfKeyVal } from "../bcf/bcfKeyVal";
import { SysUtil } from "./sysUtil";
import {format} from "util";

export class Message {
    messages: Map<string, string> = new Map<string, string>()

    public constructor() {

    }

    public get(key: string, ...args: any[]) {
        var msg: string = this.messages.get(key);
        if(msg == null)
            msg = key;

        return format(msg, ...args);
    }

    public init(conf: string, locale: Locale)  {
        var lang = locale.language;
        this.initBcf(conf + ".bcf");
        if(StrUtil.isSet(lang) && lang != "en")
            this.initBcf(conf + "_" + lang + ".bcf");
    }


    private initBcf(file : string) {
        if(!SysUtil.isFile(file)){
            BayLog.warn("Cannot find message file: %s", file);
        }
        else {
            let p: BcfParser = new BcfParser();
            let doc: BcfDocument = p.parse(file);
    
            for(const o of doc.contentList) {
                if(o instanceof BcfKeyVal) {
                    let kv = o as BcfKeyVal;
                    this.messages.set(kv.key, kv.value)
                }
            }        
        }
    }

    

}