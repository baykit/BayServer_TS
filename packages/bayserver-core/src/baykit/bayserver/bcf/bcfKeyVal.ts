import { BcfObject } from "./bcfObject";

export class BcfKeyVal extends BcfObject {
    
    public key: string
    public value: string
    
    public constructor(key: string, value: string, fileName: string, lineNo: number) {
        super(fileName, lineNo);
        this.key = key;
        this.value = value;
    }
}
