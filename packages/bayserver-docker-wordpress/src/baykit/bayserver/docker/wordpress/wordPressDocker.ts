
import {RerouteBase} from "bayserver-core/baykit/bayserver/docker/base/rerouteBase";
import {Town} from "bayserver-core/baykit/bayserver/docker/town";
import {BcfElement} from "bayserver-core/baykit/bayserver/bcf/bcfElement";
import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {SysUtil} from "bayserver-core/baykit/bayserver/util/sysUtil";

export class WordPressDocker extends RerouteBase {

    townPath: string

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////


    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        let twn = parent as Object as Town;
        this.townPath = twn.getLocation();
    }

    //////////////////////////////////////////////////////
    // Implements Reroute
    //////////////////////////////////////////////////////

    reroute(twn: Town, uri: string): string {
        let parts = uri.split("?")
        let uri2 = parts[0]
        if(!this.match(uri2))
            return uri;

        let relPath = uri2.substring(twn.getName().length);
        if(relPath.startsWith("/"))
            relPath = relPath.substring(1);

        parts = relPath.split("/");
        let checkPath = "";
        for(const part of parts) {
            if(StrUtil.isSet(checkPath))
                checkPath += "/";
            checkPath += part;
            if(SysUtil.exists(SysUtil.joinPath(twn.getLocation(), checkPath)))
                return uri;
        }

        let f = SysUtil.joinPath(twn.getLocation(), relPath);
        if(!SysUtil.exists(f))
            return twn.getName() + "index.php/" + uri.substring(twn.getName().length);
        else
            return uri;
    }

}


module.exports = {
    createDocker: (): Docker => new WordPressDocker()
}