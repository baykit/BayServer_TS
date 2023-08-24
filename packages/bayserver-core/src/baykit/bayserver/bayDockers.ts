import {Docker} from "./docker/docker";
import {BcfParser} from "./bcf/bcfParser";
import {BcfDocument} from "./bcf/bcfDocument";
import {BcfKeyVal} from "./bcf/bcfKeyVal";
import {BcfElement} from "./bcf/bcfElement";
import {StrUtil} from "./util/strUtil";
import {BayException} from "./bayException";
import {BayMessage} from "./bayMessage";
import {Symbol} from "./symbol";
import {BayLog} from "./bayLog";
import {DockerLoader} from "./util/dockerLoader";

export class BayDockers {
    static dockerMap: Map<string, string>

    static init(conf: string) {
        this.dockerMap = new Map()
        let p: BcfParser = new BcfParser();
        let doc: BcfDocument = p.parse(conf);
        //if(BayServer.logLevel == BayServer.LOG_LEVEL_DEBUG)
        //    doc.print();

        for (const o of doc.contentList) {
            if (o instanceof BcfKeyVal) {
                let kv: BcfKeyVal = o as BcfKeyVal
                BayDockers.dockerMap.set(kv.key, kv.value)
            }
        }
    }

    /**
     * Create docker from ini file element
     * @param elm
     * @return
     * @throws BayException
     */
    static createDocker(elm: BcfElement, parent: Docker ): Docker {
        let alias = elm.getValue("docker");
        let d = this.createDockerByAlias(elm.name, alias);

        d.init(elm, parent);
        return d;
    }

    static createDockerByAlias(category: string, alias: string): Docker {

        var key;
        if(StrUtil.empty(alias)) {
            key = category;
        }
        else {
            key = category + ":" + alias;
        }
        let className = this.dockerMap.get(key);

        if(className == null)
            throw new BayException(BayMessage.get(Symbol.CFG_DOCKER_NOT_FOUND, key));

        try {
            return DockerLoader.loadDocker(className)
        }
        catch(e) {
            BayLog.error_e(e)
            throw new BayException(e);
        }
    }
}