import { StrUtil } from "../util/strUtil";
import { BcfKeyVal } from "./bcfKeyVal";
import { BcfObject } from "./bcfObject";

export class BcfElement extends BcfObject {

    public name: string;
    public arg: string;
    
    public contentList: BcfObject[] = []

    public constructor(name: string, arg: string, fileName: string, lineNo: number) {
        super(fileName, lineNo);
        this.name = name;
        this.arg = arg;
    }
    
    public getValue(key: string) : string {
        for(const o of this.contentList) {
            if(o instanceof BcfKeyVal) {
                const kv : BcfKeyVal = o as BcfKeyVal;
                if(StrUtil.eqIgnoreCase(kv.key, key))
                    return kv.value;
            }
        }
        return null;
    }
}
