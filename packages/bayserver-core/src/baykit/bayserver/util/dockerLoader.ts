import {Docker} from "../docker/docker";
import {BayServer} from "../bayserver";

export class DockerLoader {

    public static loadDocker(className: string) : Docker {
        let path = className.replace(/\./g, "/")
        let mod = require(path)
        return mod.createDocker()
    }
}