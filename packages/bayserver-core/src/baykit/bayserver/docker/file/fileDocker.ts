import {ClubBase} from "../base/clubBase";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {StrUtil} from "../../util/strUtil";
import {Tour} from "../../tour/tour";
import {BayLog} from "../../bayLog";
import {SysUtil} from "../../util/sysUtil";
import {FileContentHandler} from "./fileContentHandler";
import {Docker} from "../docker";

export class FileDocker extends ClubBase {

    listFiles: boolean = false;

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////
    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "listfiles":
                this.listFiles = StrUtil.parseBool(kv.value);
                break;
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    arrive(tur: Tour) {

        let relPath = tur.req.rewrittenURI != null ? tur.req.rewrittenURI : tur.req.uri;
        if (!StrUtil.empty(tur.town.getName()))
            relPath = relPath.substring(tur.town.getName().length);
        let pos = relPath.indexOf('?');
        if (pos != -1)
            relPath = relPath.substring(0, pos);

        try {
            relPath = decodeURI(relPath);
        }
        catch (e) {
            BayLog.error("Cannot decode path: %s: %s", relPath, e);
        }

        let real = SysUtil.joinPath(tur.town.getLocation(), relPath);

        if (SysUtil.isDirectory(real) && this.listFiles) {
            //DirectoryTrain train = new DirectoryTrain(tur, real);
            //train.startTour();
        }
        else {
            let handler = new FileContentHandler(real);
            tur.req.setContentHandler(handler);
        }
    }
}


module.exports = {
    createDocker: (): Docker => new FileDocker()
}