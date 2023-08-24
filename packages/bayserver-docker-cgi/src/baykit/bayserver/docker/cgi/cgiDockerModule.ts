import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {CgiDocker} from "./cgiDocker";

module.exports = {
    createDocker: (): Docker => new CgiDocker()
}
