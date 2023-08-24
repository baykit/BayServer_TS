import {City} from "../city";
import {DockerBase} from "../base/dockerBase";
import {Club} from "../club";
import {Tour} from "../../tour/tour";
import {Trouble} from "../trouble";
import {BcfElement} from "../../bcf/bcfElement";
import {Docker} from "../docker";
import {MATCH_TYPE_CLOSE, MATCH_TYPE_NOT_MATCHED, Town} from "../town";
import {Log} from "../log";
import {Permission} from "../permission";
import {BayLog} from "../../bayLog";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {HttpException} from "../../httpException";
import {HttpStatus} from "../../util/httpStatus";
import {BayServer} from "../../bayserver";
import {StrUtil} from "../../util/strUtil";
import {SysUtil} from "../../util/sysUtil";
import {BayDockers} from "../../bayDockers";


export class ClubMatchInfo {
    club: Club;
    scriptName: string;
    pathInfo: string;
}

export class MatchInfo {
    town: Town;
    clubMatch: ClubMatchInfo;
    queryString: string;
    redirectURI: string;
    rewrittenURI: string;
}

export class BuiltInCityDocker extends DockerBase implements City {

    townList: Town[] = [];
    defaultTown: Town;

    clubList: Club[] = [];
    defaultClub: Club;

    logList: Log[] = [];
    permissionList: Permission[] = [];

    trouble: Trouble;

    name: string;

    toString(): string {
        return "cty$" + this.name
    }
    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        this.name = elm.arg;
        this.townList.sort((t1, t2) => {
            let l1 = t1.getName().length
            let l2 = t2.getName().length
            return l1 > l2 ? -1 : (l1 == l2 ? 0 : -1)
        });

        for(const t of this.townList) {
            BayLog.debug(BayMessage.get(Symbol.MSG_SETTING_UP_TOWN, t.getName(), t.getLocation()));
        }

        this.defaultTown = BayDockers.createDockerByAlias("town", null) as Town
        this.defaultClub = BayDockers.createDockerByAlias("club", "file") as Club
    }

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initDocker(dkr: Docker): boolean {
        switch(dkr.getType()) {
            case "town":
                this.townList.push(dkr as Object as Town);
                break;
            case "club":
                this.clubList.push(dkr as Object as Club);
                break;
            case "log":
                this.logList.push(dkr as Object as Log);
                break;
            case "permission":
                this.permissionList.push(dkr as Object as Permission);
                break
            case "trouble":
                this.trouble = dkr as Object as Trouble;
                break;
            default:
                return false;
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements City
    //////////////////////////////////////////////////////
    getName(): string {
        return this.name;
    }

    getClubs(): Club[] {
        return this.clubList
    }
    getTowns(): Town[] {
        return this.townList;
    }
    enter(tur: Tour) {
        BayLog.debug("%s City[%s] Request URI: %s", tur, this.name, tur.req.uri);

        tur.city = this;

        for (const p of this.permissionList) {
            p.tourAdmitted(tur);
        }

        let mInfo: MatchInfo = this.getTownAndClub(tur.req.uri);
        if(mInfo == null) {
            throw new HttpException(HttpStatus.NOT_FOUND, tur.req.uri);
        }

        mInfo.town.checkAdmitted(tur);

        if(mInfo.redirectURI != null) {
            throw HttpException.movedTemp(mInfo.redirectURI);
        }
        else {
            if(BayLog.isDebug())
                BayLog.debug("%s Town[%s] Club[%s]", tur, mInfo.town.getName(), mInfo.clubMatch.club);
            tur.req.queryString = mInfo.queryString;
            tur.req.scriptName = mInfo.clubMatch.scriptName;

            if(mInfo.clubMatch.club.getCharset() != null) {
                tur.req.charset = mInfo.clubMatch.club.getCharset();
                tur.res.charset = mInfo.clubMatch.club.getCharset();
            }
            else {
                tur.req.charset = BayServer.harbor.getCharset();
                tur.res.charset = BayServer.harbor.getCharset();
            }

            tur.req.pathInfo = mInfo.clubMatch.pathInfo;
            if(tur.req.pathInfo != null && mInfo.clubMatch.club.getrDecodePathInfo()) {
                try {
                    tur.req.pathInfo = decodeURI(tur.req.pathInfo);
                }
                catch(e) {
                    BayLog.error_e(e);
                    try {
                        tur.req.pathInfo = decodeURI(tur.req.pathInfo);
                    }
                    catch (ee) {
                        BayLog.error_e(ee);
                    }
                }
            }
            if(mInfo.rewrittenURI != null) {
                tur.req.rewrittenURI = mInfo.rewrittenURI;  // URI is rewritten
            }

            let club = mInfo.clubMatch.club;
            tur.town = mInfo.town;
            tur.club = club;
            club.arrive(tur);
        }
    }

    getTrouble(): Trouble {
        return this.trouble;
    }

    log(tour: Tour) {
        for(const d of this.logList) {
            try {
                d.log(tour);
            } catch (e) {
                BayLog.error_e(e);
            }
        }
    }

    getType(): string {
        return "city";
    }

    //////////////////////////////////////////////////////
    // private methods
    //////////////////////////////////////////////////////
    clubMaches(clubList: Club[], relUri: string, townName: string): ClubMatchInfo {

        let mi = new ClubMatchInfo();
        let anyd: Club = null;

        for (const d of clubList) {
            if (d.getFileName() == "*" && d.getExtension() == null) {
    // Ignore any match club
                anyd = d;
                break;
            }
        }

        // search for club
        let parts = relUri.split("/");
        var relScriptName = "";
    loop:
        for(const fname of parts) {
            if(relScriptName != "")
                relScriptName += '/';
            relScriptName += fname;
            for (const d of clubList) {
                if(d === anyd) {
                    // Ignore any match club
                    continue;
                }

                if (d.matches(fname)) {
                    mi.club = d;
                    break loop;
                }
            }
        }

        if (mi.club == null && anyd != null) {
                mi.club = anyd;
        }

        if (mi.club == null)
            return null;

        if (townName == "/" &&  relScriptName == "") {
            mi.scriptName = "/";
            mi.pathInfo = null;
        }
        else {
            mi.scriptName = townName + relScriptName;
            if (relScriptName.length == relUri.length)
                mi.pathInfo = null;
            else
                mi.pathInfo = relUri.substring(relScriptName.length);
        }

        return mi;
    }


    /**
     * Determine club from request URI
     */
    getTownAndClub(reqUri: string): MatchInfo {
        if(reqUri == null)
            throw new Error("nullPo")
        let mi = new MatchInfo();

        var uri = reqUri;
        let pos = uri.indexOf('?');
        if(pos != -1) {
            mi.queryString = uri.substring(pos + 1);
            uri = uri.substring(0, pos);
        }

        for(const t of this.townList) {
            let m = t.matches(uri);
            if (m == MATCH_TYPE_NOT_MATCHED)
                continue;

            // town matched
            mi.town = t;
            if (m == MATCH_TYPE_CLOSE) {
                mi.redirectURI = uri + "/";
                if(mi.queryString != null)
                    mi.redirectURI += mi.queryString;
                return mi;
            }

            let orgUri = uri;
            uri = t.reroute(uri);
            if(uri != orgUri)
                mi.rewrittenURI = uri;

            let rel = uri.substring(t.getName().length);

            mi.clubMatch = this.clubMaches(t.getClubs(), rel, t.getName());

            if(mi.clubMatch == null) {
                mi.clubMatch = this.clubMaches(this.clubList, rel, t.getName());
            }

            if (mi.clubMatch == null) {
                // check index file
                if(uri.endsWith("/") && !StrUtil.empty(t.getWelcomeFile())) {
                    let indexUri = uri + t.getWelcomeFile();
                    let relUri = rel + t.getWelcomeFile();
                    let indexLocation = SysUtil.joinPath(t.getLocation(), relUri);
                    if(SysUtil.isFile(indexLocation)) {
                        if (mi.queryString != null)
                            indexUri += "?" + mi.queryString;
                        let m2 = this.getTownAndClub(indexUri);
                        if (m2 != null) {
                            // matched
                            m2.rewrittenURI = indexUri;
                            return m2;
                        }
                    }
                }

                // default club matches
                mi.clubMatch = new ClubMatchInfo();
                mi.clubMatch.club = this.defaultClub;
                mi.clubMatch.scriptName = null;
                mi.clubMatch.pathInfo = null;
            }

            return mi;
        }

        return null;
    }
}

module.exports = {
    createDocker: (): Docker => new BuiltInCityDocker()
}