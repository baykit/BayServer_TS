import {Md5Password} from "./md5Password";
import {BcfParser} from "../bcf/bcfParser";
import {BcfElement} from "../bcf/bcfElement";
import {StrUtil} from "./strUtil";
import {BcfKeyVal} from "../bcf/bcfKeyVal";

class Member {
    name: string
    digest: string;

    constructor(name: string, digest: string) {
        this.name = name;
        this.digest = digest;
    }

    validate(password: string): boolean {
        if(password == null)
            return false;
        let dig = Md5Password.encode(password);
        return this.digest == dig;
        }
}
export class Group {
    name: string
    members: string[] = []


    constructor(name: string) {
        this.name = name;
    }

    add(name: string): void {
        this.members.push(name)
    }

    validate(mName: string, pass: string) : boolean {
        if(!(mName in this.members))
            return false;
        let m = Groups.allMembers[mName];
        if(m == null)
            return false;
        return m.validate(pass);
    }
}


export class Groups {
    static allGroups: {[key: string]: Group} = {}
    static allMembers: {[key: string]: Member} = {}

    static init(conf: string): void {
        let p = new BcfParser();
        let doc = p.parse(conf);
        for(const o of doc.contentList) {
            if(o instanceof BcfElement) {
                let elm = o as BcfElement;
                if(StrUtil.eqIgnoreCase(elm.name, "group")) {
                    this.initGroups(elm);
                }
                else if(StrUtil.eqIgnoreCase(elm.name, "member")) {
                    this.initMembers(elm);
                }
            }
        }
    }

    static getGroup(name: string): Group {
        return this.allGroups[name]
    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////

    private static initGroups(elm: BcfElement): void {
        for(const o of elm.contentList) {
            if(o instanceof BcfKeyVal) {
                let kv = o as BcfKeyVal;
                let g = new Group(kv.key);
                this.allGroups[g.name] = g;
                let names = kv.value.split(" ")
                for(const mName of names) {
                    g.add(mName);
                }
            }
        }
    }

    private static initMembers(elm: BcfElement): void {
        for(const o of elm.contentList) {
            if(o instanceof BcfKeyVal) {
                let kv = o as BcfKeyVal;
                let m = new Member(kv.key, kv.value);
                this.allMembers[m.name] = m;
            }
        }
    }
}