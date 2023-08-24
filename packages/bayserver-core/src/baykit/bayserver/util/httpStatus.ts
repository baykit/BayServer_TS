import {BayLog} from "../bayLog";
import {BcfParser} from "../bcf/bcfParser";
import {BcfKeyVal} from "../bcf/bcfKeyVal";
import {BcfDocument} from "../bcf/bcfDocument";

export class HttpStatus {
    public static readonly OK: number = 200;
    public static readonly MOVED_PERMANENTLY: number = 301;
    public static readonly MOVED_TEMPORARILY: number = 302;
    public static readonly NOT_MODIFIED: number = 304;
    public static readonly BAD_REQUEST: number = 400;
    public static readonly UNAUTHORIZED: number = 401;
    public static readonly FORBIDDEN: number = 403;
    public static readonly NOT_FOUND: number = 404;
    public static readonly UPGRADE_REQUIRED: number = 426;
    public static readonly INTERNAL_SERVER_ERROR: number = 500;
    public static readonly SERVICE_UNAVAILABLE: number = 503;
    public static readonly GATEWAY_TIMEOUT: number = 504;
    public static readonly HTTP_VERSION_NOT_SUPPORTED: number = 505;


    static initialized: boolean = false;
    static statusMap: Map<number, string>

    public static description(statusCode: number): string {
        let desc: string = HttpStatus.statusMap.get(statusCode)
        if (desc == null) {
            BayLog.error("Status " + statusCode + " is invalid.");
            return "Unknown Status";
        }
        return desc;
    }

    public static init(conf: string){
        if(this.initialized)
            return;

        this.statusMap = new Map()
        let p: BcfParser = new BcfParser();
        let doc: BcfDocument = p.parse(conf);

        for(const o of doc.contentList) {
            if (o instanceof BcfKeyVal) {
                let kv: BcfKeyVal = o as BcfKeyVal;
                this.statusMap.set(Number.parseInt(kv.key), kv.value)
            }
        }
        this.initialized = true;
    }
}