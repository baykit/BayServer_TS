import {BcfParser} from "../bcf/bcfParser";
import {BcfDocument} from "../bcf/bcfDocument";
import {BcfKeyVal} from "../bcf/bcfKeyVal";

export class Mimes {
    static mimeMap: Map<string, string>

    public static init(conf: string) {
        this.mimeMap = new Map()

        let p: BcfParser = new BcfParser();
        let doc: BcfDocument = p.parse(conf);
        for (const o of doc.contentList) {
            if (o instanceof BcfKeyVal) {
                let kv = o as BcfKeyVal
                Mimes.mimeMap.set(kv.key.toLowerCase(), kv.value)
            }
        }
    }

    public static getType(ext: string): string {
        return Mimes.mimeMap.get(ext.toLowerCase())
    }
}