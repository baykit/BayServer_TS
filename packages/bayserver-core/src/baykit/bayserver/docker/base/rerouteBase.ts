import {DockerBase} from "./dockerBase";
import {Reroute} from "../reroute";
import {BcfElement} from "../../bcf/bcfElement";
import {Docker} from "../docker";
import {ConfigException} from "../../configException";
import {Town} from "../town";

export abstract class RerouteBase extends DockerBase implements Reroute {

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        let name = elm.arg;
        if(name != "*")
            throw new ConfigException(elm.fileName, elm.lineNo, "Invalid reroute name: " + name);

        super.init(elm, parent);
    }

    //////////////////////////////////////////////////////
    // Implements Reroute
    //////////////////////////////////////////////////////

    abstract reroute(twn: Town, uri: string): string

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    match(uri: string): boolean {
        return true
    }
}
