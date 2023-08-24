import {Tour} from "../tour/tour";
import {BayServer} from "../bayserver";
import {StrUtil} from "./strUtil";
import {HttpHeaders} from "./httpHeaders";
import {SysUtil} from "./sysUtil";
import {BayLog} from "../bayLog";
import {env} from "process";

export type AddListener = (name, value) => void

export class CGIUtil {

    static readonly REQUEST_METHOD = "REQUEST_METHOD";
    static readonly REQUEST_URI = "REQUEST_URI";
    static readonly SERVER_PROTOCOL = "SERVER_PROTOCOL";
    static readonly GATEWAY_INTERFACE = "GATEWAY_INTERFACE";
    static readonly SERVER_NAME = "SERVER_NAME";
    static readonly SERVER_PORT = "SERVER_PORT";
    static readonly QUERY_STRING = "QUERY_STRING";
    static readonly SCRIPT_NAME = "SCRIPT_NAME";
    static readonly SCRIPT_FILENAME = "SCRIPT_FILENAME";
    static readonly PATH_TRANSLATED = "PATH_TRANSLATED";
    static readonly PATH_INFO = "PATH_INFO";
    static readonly CONTENT_TYPE = "CONTENT_TYPE";
    static readonly CONTENT_LENGTH = "CONTENT_LENGTH";
    static readonly REMOTE_ADDR = "REMOTE_ADDR";
    static readonly REMOTE_PORT = "REMOTE_PORT";
    static readonly REMOTE_USER = "REMOTE_USER";
    static readonly HTTP_ACCEPT = "HTTP_ACCEPT";
    static readonly HTTP_COOKIE = "HTTP_COOKIE";
    static readonly HTTP_HOST = "HTTP_HOST";
    static readonly HTTP_USER_AGENT = "HTTP_USER_AGENT";
    static readonly HTTP_ACCEPT_ENCODING = "HTTP_ACCEPT_ENCODING";
    static readonly HTTP_ACCEPT_LANGUAGE = "HTTP_ACCEPT_LANGUAGE";
    static readonly HTTP_CONNECTION = "HTTP_CONNECTION";
    static readonly HTTP_UPGRADE_INSECURE_REQUESTS = "HTTP_UPGRADE_INSECURE_REQUESTS";
    static readonly HTTPS = "HTTPS";
    static readonly PATH = "PATH";
    static readonly SERVER_SIGNATURE = "SERVER_SIGNATURE";
    static readonly SERVER_SOFTWARE = "SERVER_SOFTWARE";
    static readonly SERVER_ADDR = "SERVER_ADDR";
    static readonly DOCUMENT_ROOT = "DOCUMENT_ROOT";
    static readonly REQUEST_SCHEME = "REQUEST_SCHEME";
    static readonly CONTEXT_PREFIX = "CONTEXT_PREFIX";
    static readonly CONTEXT_DOCUMENT_ROOT = "CONTEXT_DOCUMENT_ROOT";
    static readonly SERVER_ADMIN = "SERVER_ADMIN";
    static readonly REQUEST_TIME_FLOAT = "REQUEST_TIME_FLOAT";
    static readonly REQUEST_TIME = "REQUEST_TIME";
    static readonly UNIQUE_ID = "UNIQUE_ID";

    static getEnvHash(
        path: string,
        docRoot: string,
        scriptBase: string,
        tur: Tour): {[key: string]: string} {

        let env: {[key: string]: string} = {}

        let callback = (name, value) => {
            env[name] = value
        }

        CGIUtil.getEnv(path, docRoot, scriptBase, tur, callback)

        return env
    }

    static getEnv(
        path: string,
        docRoot: string,
        scriptBase: string,
        tour: Tour,
        lis: AddListener): void {

        let reqHeaders = tour.req.headers;

        let ctype = reqHeaders.contentType();
        if(ctype != null) {
            let pos = ctype.indexOf("charset=");
            if(pos >= 0) {
                tour.req.charset = ctype.substring(pos+8).trim();
            }
        }

        this.addEnv(lis, this.REQUEST_METHOD, tour.req.method);
        this.addEnv(lis, this.REQUEST_URI, tour.req.uri);
        this.addEnv(lis, this.SERVER_PROTOCOL, tour.req.protocol);
        this.addEnv(lis, this.GATEWAY_INTERFACE, "CGI/1.1");

        this.addEnv(lis, this.SERVER_NAME, tour.req.reqHost);
        this. addEnv(lis, this.SERVER_ADDR, tour.req.serverAddress);
        if(tour.req.reqPort >= 0)
            this.addEnv(lis, this.SERVER_PORT, tour.req.reqPort.toString());
        this.addEnv(lis, this.SERVER_SOFTWARE, BayServer.getSoftwareName());

        this.addEnv(lis, this.CONTEXT_DOCUMENT_ROOT, docRoot);


        for(let name of tour.req.headers.names()) {
            let newVal: string = null;
            for(const value of tour.req.headers.values(name)) {
                if (newVal == null)
                    newVal = value;
                else {
                    newVal = newVal + "; " + value;
                }
            }

            name = name.toUpperCase().replace(new RegExp('-', 'g'), '_');
            if(name.startsWith("X_FORWARDED_")) {
                this.addEnv(lis, name, newVal);
            }
            else {
                switch (name) {
                    case this.CONTENT_TYPE:
                    case this.CONTENT_LENGTH:
                        this.addEnv(lis, name, newVal);
                        break;

                    default:
                        this.addEnv(lis, "HTTP_" + name, newVal);
                        break;
                }
            }
        }

        this.addEnv(lis, this.REMOTE_ADDR, tour.req.remoteAddress);
        this.addEnv(lis, this.REMOTE_PORT, tour.req.remotePort.toString());
        //addEnv(map, REMOTE_USER, "unknown");

        this.addEnv(lis, this.REQUEST_SCHEME, tour.isSecure ? "https": "http");

        let tmpSecure = tour.isSecure;
        let fproto = tour.req.headers.get(HttpHeaders.X_FORWARDED_PROTO);
        if(fproto != null) {
            tmpSecure = StrUtil.eqIgnoreCase(fproto, "https");
        }
        if(tmpSecure)
            this.addEnv(lis, this.HTTPS, "on");

        this.addEnv(lis, this.QUERY_STRING, tour.req.queryString);
        this.addEnv(lis, this.SCRIPT_NAME, tour.req.scriptName);

        if(tour.req.pathInfo == null) {
            this.addEnv(lis, this.PATH_INFO, "");
        }
        else {
            this.addEnv(lis, this.PATH_INFO, tour.req.pathInfo);
            try {
                let pathTranslated = SysUtil.joinPath(docRoot, tour.req.pathInfo);
                this.addEnv(lis, this.PATH_TRANSLATED, pathTranslated);
            }
            catch(e) {
                BayLog.error_e(e);
            }
        }

        if(!scriptBase.endsWith("/"))
            scriptBase = scriptBase + "/";
        this.addEnv(lis, this.SCRIPT_FILENAME, scriptBase + tour.req.scriptName.substring(path.length));
        this.addEnv(lis, this.PATH, env["PATH"]);
    }

    private static addEnv(lis: AddListener, key: string, value: Object) {
        if(value == null)
            value = ""
        lis(key, value.toString())
    }
}