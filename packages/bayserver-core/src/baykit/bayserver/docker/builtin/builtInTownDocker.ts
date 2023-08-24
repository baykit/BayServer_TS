import {Club} from "../club";
import {Permission} from "../permission";
import {Reroute} from "../reroute";
import {City} from "../city";
import {BcfElement} from "../../bcf/bcfElement";
import {Docker} from "../docker";
import {DockerBase} from "../base/dockerBase";
import {MATCH_TYPE_CLOSE, MATCH_TYPE_MATCHED, MATCH_TYPE_NOT_MATCHED, Town} from "../town";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {SysUtil} from "../../util/sysUtil";
import {ConfigException} from "../../configException";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {BayServer} from "../../bayserver";
import { Tour } from "../../tour/tour";

export class BuiltInTownDocker extends DockerBase implements Town {

    location: string;
    welcome: string;
    clubList: Club[] = []
    permissionList: Permission[] = []
    rerouteList: Reroute[] = []
    city: City;
    name: string;

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        let arg = elm.arg;
        if(!arg.startsWith("/"))
            arg = "/" + arg;
        this.name = arg;
        if(!this.name.endsWith("/"))
            this.name = this.name + "/";
        this.city = parent as Object as City;

        super.init(elm, parent);
    }

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initDocker(dkr: Docker): boolean {
        switch(dkr.getType()) {
            case "club":
                this.clubList.push(dkr as Object as Club);
                break
            case "permission":
                this.permissionList.push(dkr as Object as Permission)
                break
            case "reroute":
                this.rerouteList.push(dkr as Object as Reroute);
                break
            default:
                return super.initDocker(dkr);
        }
        return true;
    }

    initKeyVal(kv: BcfKeyVal): boolean {
        switch(kv.key.toLowerCase()) {
            default:
                return false;

            case "location": {
                this.location = kv.value;
                if(!SysUtil.isAbsolutePath(this.location))
                    this.location = BayServer.getLocation(this.location)
                if(!SysUtil.isDirectory(this.location))
                    throw new ConfigException(kv.fileName,  kv.lineNo, BayMessage.get(Symbol.CFG_INVALID_LOCATION, this.location));
                //this.location = fs.realpath(this.location)
                break;
            }

            case "index":
            case "welcome":
                this.welcome = kv.value;
                break;
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements Town
    //////////////////////////////////////////////////////

    getName(): string {
        return this.name
    }

    getCity(): City {
        return this.city
    }

    getLocation(): string {
        return this.location
    }

    getWelcomeFile(): string {
        return this.welcome
    }

    getClubs(): Club[] {
        return this.clubList
    }

    reroute(uri: string): string {
        for (const r of this.rerouteList) {
            uri = r.reroute(this, uri);
        }

        return uri;
    }

    matches(uri: string): number {
        if(uri.startsWith(this.name))
            return MATCH_TYPE_MATCHED;
        else if(uri + "/" ==  this.name)
            return MATCH_TYPE_CLOSE;
        else
            return MATCH_TYPE_NOT_MATCHED;
    }

    checkAdmitted(tour: Tour) {
        for(const p of this.permissionList) {
            p.tourAdmitted(tour);
        }
    }
}

module.exports = {
    createDocker: (): Docker => new BuiltInTownDocker()
}