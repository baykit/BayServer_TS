import {DockerBase} from "../base/dockerBase";
import {Secure} from "../Secure";
import {Docker} from "../docker";
import {BcfElement} from "../../bcf/bcfElement";
import {ConfigException} from "../../configException";
import {BayMessage} from "../../bayMessage";
import {Symbol} from "../../symbol";
import {BcfKeyVal} from "../../bcf/bcfKeyVal";
import {StrUtil} from "../../util/strUtil";
import {BayLog} from "../../bayLog";
import * as fs from "fs";
import {Transporter} from "../../agent/transporter/transporter";
import {SysUtil} from "../../util/sysUtil";
import {BayServer} from "../../bayserver";
import {IOException} from "../../util/ioException";
import * as tls from "tls";
import {SecureTransporter} from "../../agent/transporter/secureTransporter";
import * as net from "net";

export class BuiltInSecureDocker extends DockerBase implements Secure{
    static readonly DEFAULT_CLIENT_AUTH = false

    static readonly DEFAULT_SSL_PROTOCOL = "TLS"

    // SSL setting
    keyStore: string
    keyStorePass: string
    clientAuth: boolean = BuiltInSecureDocker.DEFAULT_CLIENT_AUTH
    sslProtocol: string = BuiltInSecureDocker.DEFAULT_SSL_PROTOCOL
    keyFile: string
    certFile: string
    certs: string
    certsPass: string
    traceSSL: boolean
    sslctx
    appProtocols: string[] = null

    //////////////////////////////////////////////////////
    // Implements Docker
    //////////////////////////////////////////////////////

    init(elm: BcfElement, parent: Docker) {
        super.init(elm, parent);

        if(this.keyStore == null && (this.keyFile == null || this.certFile == null)) {
            throw new ConfigException(elm.fileName, elm.lineNo, "Key file or cert file is not specified");
        }

        try {
            this.initSSL();
        } catch (e) {
            throw new ConfigException(
                elm.fileName,
                elm.lineNo,
                e,
                BayMessage.get(Symbol.CFG_SSL_INIT_ERROR, e.message),
                e);
        }
    }


    //////////////////////////////////////////////////////
    // Implements DockerBase
    //////////////////////////////////////////////////////


    initKeyVal(kv: BcfKeyVal): boolean {
        try {
            switch(kv.key.toLowerCase()) {
                default:
                    return false;

                case "key":
                    this.keyFile = this.getFilePath(kv.value);
                    break;

                case "cert":
                    this.certFile = this.getFilePath(kv.value);
                    break;

                case "keystore":
                    this.keyStore = this.getFilePath(kv.value);
                    break;

                case "keystorepass":
                    this.keyStorePass = kv.value;
                    break;

                case "clientauth":
                   this.clientAuth = StrUtil.parseBool(kv.value);
                    break;

                case "sslprotocol":
                    this.sslProtocol = kv.value;
                    break;

                case "trustcerts":
                    this.certs = this.getFilePath(kv.value);
                    break;

                case "certsPass":
                    this.certsPass = kv.value;
                    break;

                case "tracessl":
                    this.traceSSL = StrUtil.parseBool(kv.value);
                    break;
            }
            return true;
        }
        catch(e) {
            BayLog.error_e(e);
            throw new ConfigException(
                kv.fileName,
                kv.lineNo,
                BayMessage.get(
                    Symbol.CFG_FILE_NOT_FOUND,
                    e.message));
        }
    }


    //////////////////////////////////////////////////////
    // Implements Secure
    //////////////////////////////////////////////////////

    setAppProtocols(protocols: string[]) {
        this.appProtocols = protocols
        this.sslctx["ALPNProtocols"] = this.appProtocols
    }

    createTransporter(): Transporter {
        return new SecureTransporter(this.sslctx, true, this.traceSSL);
    }

    reloadCert() {
        this.initSSL()
    }

    createServer(): net.Server {
        return tls.createServer(this.sslctx);
    }



    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    private initSSL() {
        if(this.traceSSL)
            BayLog.info("init SSL engine");

        this.sslctx = {
            key: fs.readFileSync(this.keyFile),
            cert: fs.readFileSync(this.certFile),
            requestCert: this.clientAuth,
            enableTrace: this.traceSSL
        }
        if(this.appProtocols)
            this.sslctx["ALPNProtocols"] = this.appProtocols

    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////


    private getFilePath(fileName: string) {
        fileName = BayServer.getLocation(fileName)
        if (!SysUtil.isFile(fileName)) {
            throw new IOException("File not found: " + fileName);
        }
        else
            return fileName;
        return "";
    }

    createTlsSocket(ch: net.Socket, server: net.Server): net.Socket {
        let ctx = {
            enableTrace: this.traceSSL,
            isServer: true,
            server: server,
            secureContext: tls.createSecureContext(this.sslctx)
        }
        if(this.appProtocols)
            ctx["ALPNProtocols"] = this.appProtocols
        return new tls.TLSSocket(ch, ctx);
    }
}

module.exports = {
    createDocker: (): Docker => new BuiltInSecureDocker()
}