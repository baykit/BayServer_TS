import {Docker} from "../docker";
import {BcfElement} from "../../bcf/bcfElement";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {ConfigException} from "../../configException";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {BayDockers} from "../../bayDockers";
import {BayException} from "../../bayException";
import {BayLog} from "../../bayLog";

export abstract class DockerBase implements Docker {

    type: string;

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////
    public init(elm: BcfElement, parent: Docker) {
        this.type = elm.name;
        for (const o of elm.contentList) {
            if (o instanceof BcfKeyVal) {
                let kv = o as BcfKeyVal;
                try {
                    if (!this.initKeyVal(kv))
                        throw new ConfigException(o.fileName, o.lineNo, BayMessage.get(Symbol.CFG_INVALID_PARAMETER, o.key));
                }
                catch(e) {
                    if(e instanceof ConfigException)
                        throw e;
                    else {
                        BayLog.error_e(e)
                        throw new ConfigException(kv.fileName, kv.lineNo, e);
                    }
                }
            }
            else {
                let element = o as BcfElement;
                var dkr: Docker;
                try {
                    dkr = BayDockers.createDocker(element, this);
                }
                catch (e) {
                    let b = e instanceof BayException
                    if (e instanceof ConfigException)
                        throw e;
                    else {
                        BayLog.error_e(e);
                        throw new ConfigException(element.fileName, element.lineNo, BayMessage.get(Symbol.CFG_INVALID_DOCKER, element.name));
                    }
                }

                if (!this.initDocker(dkr))
                    throw new ConfigException(o.fileName, o.lineNo, BayMessage.get(Symbol.CFG_INVALID_DOCKER, (o as BcfElement).name));
            }
        }
    }

    getType(): string {
        return this.type;
    }

    //////////////////////////////////////////////////////
    // Base methods
    //////////////////////////////////////////////////////
    initDocker(dkr: Docker): boolean {
        return false;
    }

    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return false;

            case "docker":
                return true;
        }
    }
}
