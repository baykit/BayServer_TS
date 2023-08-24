import {DockerBase} from "./dockerBase";
import {Club} from "../club";
import {BcfElement} from "../../bcf/bcfElement";
import {Docker} from "../docker";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {StrUtil} from "../../util/strUtil";
import {Tour} from "../../tour/tour";

export abstract class ClubBase extends DockerBase implements Club {

    fileName: string;
    extension: string;
    charset: string;
    decodePathInfo: boolean = true;

    toString(): string {
        return "clb$" + this.constructor.name
    }

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        let p = elm.arg.lastIndexOf('.');
        if (p == -1) {
            this.fileName = elm.arg;
            this.extension = null;
        } else {
            this.fileName = elm.arg.substring(0, p);
            this.extension = elm.arg.substring(p + 1);
        }
    }


    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initKeyVal(kv: BcfKeyVal): boolean {
        switch(kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "decodepathinfo":
                this.decodePathInfo = StrUtil.parseBool(kv.value);
                break;
            case "charset":
                let cs = kv.value;
                if(StrUtil.isSet(cs))
                    this.charset = cs;
                break;
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements Club
    //////////////////////////////////////////////////////

    getFileName(): string {
        return this.fileName;
    }

    getExtension(): string {
        return this.extension;
    }

    getCharset(): string {
        return this.charset;
    }

    getrDecodePathInfo(): boolean {
        return this.decodePathInfo;
    }

    abstract arrive(tour: Tour)

    matches(fname: string): boolean {
        // check club
        let pos = fname.indexOf(".");
        if(pos == -1) {
            // fname has no extension
            if(this.extension != null)
                return false;

            if(this.fileName == "*")
                return true;

            return fname == this.fileName;
        }
        else {
            //fname has extension
            if(this.extension == null)
                return false;

            let nm = fname.substring(0, pos);
            let ext = fname.substring(pos + 1);

            if(this.extension != "*" && ext != this.extension)
                return false;

            if(this.fileName == "*")
                return true;
            else
                return nm == this.fileName;
        }
    }

}