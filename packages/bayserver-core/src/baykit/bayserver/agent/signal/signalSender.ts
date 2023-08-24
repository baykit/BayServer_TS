import {BayServer} from "../../bayserver";
import {SignalAgent} from "./signalAgent";
import {BayException} from "../../bayException";
import {BayLog} from "../../bayLog";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol"
import {BcfParser} from "../../bcf/bcfParser";
import {BcfElement} from "../../bcf/bcfElement";
import {StrUtil} from "../../util/strUtil";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import * as net from "net";
import * as fs from "fs";
import {exit} from "process";

export class SignalSender {

    bayPort = -1;
    pidFile = "bayserver.pid";

    /**
     * Send running BayServer a command
     */
    sendCommand(cmd: string) {
        this.parseBayPort(BayServer.bservPlan);
        if(this.bayPort  < 0) {
            let pid = this.readPidFile();
            let sig = SignalAgent.getSignalFromCommand(cmd);
            if(sig == null)
                throw new BayException("Invalid command: " + cmd);
            if(pid <= 0)
                throw new BayException("Invalid process ID: " + pid);
            this.kill(pid, sig);
        }
        else {
            BayLog.info(BayMessage.get(Symbol.MSG_SENDING_COMMAND, cmd));
            this.send("localhost", this.bayPort, cmd);
        }
    }

    /**
     * Parse plan file and get port number of SignalAgent
     */
    private parseBayPort(plan: string) {
        let p = new BcfParser();
        let doc = p.parse(plan);
        for(const o of doc.contentList) {
            if(o instanceof BcfElement) {
                let elm = o as BcfElement;
                if(StrUtil.eqIgnoreCase(elm.name, "harbor")) {
                    for(const o2 of elm.contentList) {
                        if (o2 instanceof BcfKeyVal) {
                            let kv = o2 as BcfKeyVal;
                            if(StrUtil.eqIgnoreCase(kv.key, "controlPort"))
                                this.bayPort = Number.parseInt(kv.value);
                            else if(StrUtil.eqIgnoreCase(kv.key, "pidFile"))
                                this.pidFile = kv.value;
                        }
                    }
                }
            }
        }
    }

    /**
     * Send another BayServer running host:port a command
     */
    private send(host: string, port: number, cmd: string) {
        let skt = new net.Socket()
        skt.connect(port, host, () => {
            skt.write(cmd + "\n", (err) => {

            })
            skt.on("data", (buf: Buffer) => {
                skt.end(() => {

                })
                exit(0)
            })
        })
        skt.on("error", (err) => {
            BayLog.error("Connect error")
            BayLog.error_e(err)
            exit(0)
        })
    }

    private readPidFile() {
        let buf = fs.readFileSync(BayServer.getLocation(this.pidFile))
        return Number.parseInt(buf.toString())
    }

    private kill(pid: number, sig: string) {
        try {
            process.kill(pid, sig)
        }
        catch(e) {
            BayLog.error_e(e)
        }

    }
}