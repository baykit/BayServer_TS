import * as net from "net";
import {Tour} from "../../tour/tour";
import {HostMatcher} from "../../util/hostMatcher";
import {IpMatcher} from "../../util/ipMatcher";
import {Group, Groups} from "../../util/groups";
import {DockerBase} from "../base/dockerBase";
import {Permission} from "../permission";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {ConfigException} from "../../configException";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {StrUtil} from "../../util/strUtil";
import {BayLog} from "../../bayLog";
import {HttpException} from "../../httpException";
import {HttpStatus} from "../../util/httpStatus";
import {HttpHeaders} from "../../util/httpHeaders";
import {Docker} from "../docker";

interface PermissionMatcher {

    matchSocket(ch: net.Socket): boolean;
    matchTour(tur: Tour): boolean
}
class CheckItem {

    matcher: PermissionMatcher
    admit: boolean


    constructor(matcher: PermissionMatcher, admit: boolean) {
        this.matcher = matcher;
        this.admit = admit;
    }

    socketAdmitted(ch: net.Socket): boolean {
        return this.matcher.matchSocket(ch) == this.admit
    }

    tourAdmitted(tur: Tour): boolean {
        return this.matcher.matchTour(tur) == this.admit
    }
}

class HostPermissionMatcher implements PermissionMatcher {

    mch: HostMatcher

    constructor(hostPtn: string) {
        this.mch = new HostMatcher(hostPtn)
    }

    matchSocket(ch: net.Socket): boolean {
        return this.mch.match(ch.remoteAddress)
    }

    matchTour(tur: Tour): boolean {
        return this.mch.match(tur.req.remoteHost())
    }
}

class IpPermissionMatcher implements PermissionMatcher {
    mch: IpMatcher

    constructor(ipDesc: string) {
        this.mch = new IpMatcher(ipDesc)
    }
    matchSocket(ch: net.Socket): boolean {
        return this.mch.match(ch.remoteAddress);
    }

    matchTour(tur: Tour): boolean {
        return this.mch.match(tur.req.remoteAddress);
    }


}

export class BuiltInPermissionDocker extends DockerBase implements Permission{

    checkList: CheckItem[] = []

    groups: Group[] = []


    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initKeyVal(kv: BcfKeyVal) {
        try {
            switch(kv.key.toLowerCase()) {
                default:
                    return false;

                case "admit":
                case "allow": {
                    for (const pm of this.parseValue(kv)) {
                        this.checkList.push(new CheckItem(pm, true));
                    }
                    break;
                }

                case "refuse":
                case "deny": {
                    for (const pm of this.parseValue(kv)) {
                        this.checkList.push(new CheckItem(pm, false));
                    }
                    break;
                }

                case "group": {
                    let groupList = kv.value.split((" "))
                    for(const gName of groupList) {
                        let g = Groups.getGroup(gName);
                        if (g == null) {
                            throw new ConfigException(
                                kv.fileName,
                                kv.lineNo,
                                BayMessage.get(Symbol.CFG_GROUP_NOT_FOUND, kv.value));
                        }
                        this.groups.push(g);
                    }
                    break;
                }
            }
            return true;
        }
        catch(e) {
            if(e instanceof ConfigException)
                throw e;
            else {
                BayLog.error_e(e)
                throw new ConfigException(
                    kv.fileName,
                    kv.lineNo,
                    BayMessage.get(Symbol.CFG_INVALID_PERMISSION_DESCRIPTION, kv.value),
                    e.message);
            }
        }
    }


    //////////////////////////////////////////////////////
    // Implements Permission
    //////////////////////////////////////////////////////

    socketAdmitted(ch) {
        // Check remote host
        let isOk = true;
        for (const chk of this.checkList) {
            if (chk.admit) {
                if (chk.socketAdmitted(ch)) {
                    isOk = true;
                    break;
                }
            }
            else {
                if (!chk.socketAdmitted(ch)) {
                    isOk = false;
                    break;
                }
            }
        }

        if (!isOk) {
            BayLog.error("Permission error: socket not admitted: %s", ch);
            throw new HttpException(HttpStatus.FORBIDDEN);
        }
    }

    tourAdmitted(tour: Tour): void {
        // Check remote host
        let isOk = true;
        for(const chk of this.checkList) {
            if(chk.admit) {
                if(chk.tourAdmitted(tour)) {
                    isOk = true;
                    break;
                }
            }
            else {
                if(!chk.tourAdmitted(tour)) {
                    isOk = false;
                    break;
                }
            }
        }

        if(!isOk)
            throw new HttpException(HttpStatus.FORBIDDEN, tour.req.uri);

        if(this.groups.length == 0)
            return;

        // Check member
        isOk = false;
        if(tour.req.remoteUser != null) {
            for(const g of this.groups) {
                if(g.validate(tour.req.remoteUser, tour.req.remotePass)) {
                    isOk = true;
                    break;
                }
            }
        }

        if(!isOk) {
            tour.res.headers.set(HttpHeaders.WWW_AUTHENTICATE, "Basic realm=\"Auth\"");
            throw new HttpException(HttpStatus.UNAUTHORIZED);
        }
    }


    //////////////////////////////////////////////////////
    // private methods
    //////////////////////////////////////////////////////

    parseValue(kv: BcfKeyVal) : PermissionMatcher[] {
        let valList = kv.value.split(" ")
        let type: string = null;
        let matchStr: string[]  = []

        if(valList.length > 0) {
            type = valList.shift()
            matchStr = valList
        }

        if(matchStr.length == 0) {
            throw new ConfigException(
                kv.fileName,
                kv.lineNo,
                BayMessage.get(Symbol.CFG_INVALID_PERMISSION_DESCRIPTION, kv.value))
        }

        let pmList: PermissionMatcher[] = []
        if(StrUtil.eqIgnoreCase(type, "host")) {
            for(const m of matchStr) {
                pmList.push(new HostPermissionMatcher(m));
            }
           return pmList;
        }
        else if(StrUtil.eqIgnoreCase(type, "ip")) {
            for(const m of matchStr) {
                pmList.push(new IpPermissionMatcher(m));
            }
            return pmList;
        }
        else {
            throw new ConfigException(
                kv.fileName,
                kv.lineNo,
                BayMessage.get(Symbol.CFG_INVALID_PERMISSION_DESCRIPTION, kv.value));
        }
    }
}

module.exports = {
    createDocker: (): Docker => new BuiltInPermissionDocker()
}