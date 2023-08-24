import { BcfElement } from "./bcfElement";
import { BcfKeyVal } from "./bcfKeyVal";
import { BcfObject } from "./bcfObject";

export class BcfDocument {
    
    public contentList: BcfObject[] = []
    
    public print() {
        this.printContentList(this.contentList, 0);
    }
    
    private printContentList(list: BcfObject[], indent: number) {
        for(const o of list) {
            this.printIndent(indent);
            if(o instanceof BcfElement) {
                const elm = o as BcfElement;
                console.log("Element(" + elm.name + "," + elm.arg + "){\n");
                this.printContentList(elm.contentList, indent + 1);
                this.printIndent(indent);
                console.log("}\n");
            }
            else {
                const kv = o as BcfKeyVal;
                this.printKeyVal(kv);
                console.log("\n");
            }
        }
    }
    
    private printKeyVal(kv: BcfKeyVal) {
        console.log("KeyVal(" + kv.key + "=" + kv.value +")");
    }
    
    private printIndent(indent: number) {
        for(let i = 0; i < indent; i++) {
            console.log(" ");
        }
    }
}
