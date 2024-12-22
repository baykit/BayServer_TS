import {BcfKeyVal} from "bayserver-core/baykit/bayserver/bcf/bcfKeyVal";
import {StrUtil} from "bayserver-core/baykit/bayserver/util/strUtil";
import {ClubBase} from "bayserver-core/baykit/bayserver/docker/base/clubBase";
import { Tour } from "bayserver-core/baykit/bayserver/tour/tour";
import {HttpException} from "bayserver-core/baykit/bayserver/httpException";
import {HttpStatus} from "bayserver-core/baykit/bayserver/util/httpStatus";
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver";
import {BayLog} from "bayserver-core/baykit/bayserver/bayLog";
import {SysUtil} from "bayserver-core/baykit/bayserver/util/sysUtil";
import {CGIUtil} from "bayserver-core/baykit/bayserver/util/CGIUtil";
import {CgiReqContentHandler} from "./cgiReqContentHandler";
import {CgiStdErrShip} from "./cgiStdErrShip";
import {CgiStdOutShip} from "./cgiStdOutShip";
import {PlainTransporter} from "bayserver-core/baykit/bayserver/agent/multiplexer/plainTransporter";
import {ReadableRudder} from "bayserver-core/baykit/bayserver/rudder/readableRudder";
import {GrandAgent} from "bayserver-core/baykit/bayserver/agent/grandAgent";
import {Multiplexer} from "bayserver-core/baykit/bayserver/common/multiplexer";
import {RudderState} from "bayserver-core/baykit/bayserver/agent/multiplexer/rudderState";
import {MULTIPLEXER_TYPE_PIGEON, MULTIPLEXER_TYPE_VALVE} from "bayserver-core/baykit/bayserver/docker/harbor";
import {Sink} from "bayserver-core/baykit/bayserver/sink";


export class CgiDocker extends ClubBase {

    static readonly DEFAULT_TIMEOUT_SEC: number = 60;

    interpreter: string;
    scriptBase: string;
    docRoot: string;
    timeoutSec: number = CgiDocker.DEFAULT_TIMEOUT_SEC;

    maxProcesses: number = -1
    processCount: number = 0
    waitCount: number = 0

    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////

    initKeyVal(kv: BcfKeyVal): boolean {
        switch (kv.key.toLowerCase()) {
            default:
                return super.initKeyVal(kv);

            case "interpreter":
                this.interpreter = kv.value;
                break;

            case "scriptase":
                this.scriptBase = kv.value;
                break;

            case "docroot":
                this.docRoot = kv.value;
                break;

            case "timeout":
                this.timeoutSec = Number.parseInt(kv.value);
                break;

            case "maxprocesses":
                this.maxProcesses = Number.parseInt(kv.value);
                break;
        }
        return true;
    }

    //////////////////////////////////////////////////////
    // Implements Club
    //////////////////////////////////////////////////////

    arrive(tur: Tour) {
        if (tur.req.uri.indexOf("..") > 0) {
            throw new HttpException(HttpStatus.FORBIDDEN, tur.req.uri);
        }

        let base = this.scriptBase;
        if(base == null)
            base = tur.town.getLocation();

        if(StrUtil.empty(base)) {
            throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, tur.town + " scriptBase of cgi docker or location of town is not specified.");
        }

        let root = this.docRoot;
        if(root == null)
            root = tur.town.getLocation();

        if(StrUtil.empty(root)) {
            throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, tur.town + " docRoot of cgi docker or location of town is not specified.");
        }

        let env: {[key: string]: string} = CGIUtil.getEnvHash(tur.town.getName(), root, base, tur);
        if (BayServer.harbor.isTraceHeader()) {
            for(const [name, value] of Object.entries(env)) {
                BayLog.info("%s cgi: env: %s=%s", tur, name, value)
            }
        }

        let fileName = env[CGIUtil.SCRIPT_FILENAME];
        if (!SysUtil.isFile(fileName)) {
            throw new HttpException(HttpStatus.NOT_FOUND, fileName);
        }

        let handler = new CgiReqContentHandler(this, tur, env);
        tur.req.setReqContentHandler(handler);
        handler.reqStartTour()
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    getWaitCount(): number {
        return this.waitCount
    }

    addProcessCount(): boolean {
        if(this.maxProcesses <= 0 || this.processCount < this.maxProcesses) {
            this.processCount ++;
            BayLog.debug("%s Process count: %d", this, this.processCount);
            return true;
        }

        this.waitCount++;
        return false;
    }

    subProcessCount(): void {
        this.processCount--
    }

    subWaitCount(): void {
        this.waitCount--
    }

    createCommand(env: { [p: string]: string }): string[] {
        let script = env[CGIUtil.SCRIPT_FILENAME]
        let command: string[]
        if (StrUtil.empty(this.interpreter))
            command = [script]
        else
            command = [this.interpreter, script]

        if (SysUtil.runOnWindows()) {
            for (let i = 0; i < command.length; i++)
                command[i] = command[i].replace('/', '\\')
        }

        return command
    }
}
