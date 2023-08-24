import {CgiDocker} from "./cgiDocker";
import {Docker} from "bayserver-core/baykit/bayserver/docker/docker";
import {BcfElement} from "bayserver-core/baykit/bayserver/bcf/bcfElement";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {CGIUtil} from "bayserver-core/baykit/bayserver/util/CGIUtil";

export class PhpCGIDocker extends CgiDocker {

    static readonly ENV_PHP_SELF = "PHP_SELF";
    static readonly ENV_REDIRECT_STATUS = "REDIRECT_STATUS"

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        if(this.interpreter == null)
            this.interpreter = "php-cgi";

        BayLog.info("PHP interpreter: " + this.interpreter);
    }

    //////////////////////////////////////////////////////
    // Implements CgiDocker
    //////////////////////////////////////////////////////


    createCommand(env: { [p: string]: string }): string[] {
        env[PhpCGIDocker.ENV_PHP_SELF] = env[CGIUtil.SCRIPT_NAME];
        env[PhpCGIDocker.ENV_REDIRECT_STATUS] = "200"
        return super.createCommand(env);
    }
}


module.exports = {
    createDocker: (): Docker => new PhpCGIDocker()
}