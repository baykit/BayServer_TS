/**
 * HPACK spec
 *
 * https://datatracker.ietf.org/doc/html/rfc7541
 */
import {KeyVal} from "bayserver-core/baykit/bayserver/util/keyVal";

export class HeaderTable {

    static readonly PSEUDO_HEADER_AUTHORITY = ":authority";
    static readonly PSEUDO_HEADER_METHOD = ":method";
    static readonly PSEUDO_HEADER_PATH = ":path";
    static readonly PSEUDO_HEADER_SCHEME = ":scheme";
    static readonly PSEUDO_HEADER_STATUS = ":status";

    static staticTable = new HeaderTable();
    static staticSize: number;

    idxMap: KeyVal[] = []
    addCount: number;

    nameMap: Map<string, number[]>

    constructor() {
        this.nameMap = new Map()
    }

    get(idx: number): KeyVal {
        if(idx <= 0 || idx > HeaderTable.staticSize + Object.keys(this.idxMap).length)
            throw new Error("Illegal Argument: idx=" + idx + " static=" + HeaderTable.staticSize + " dynamic=" + Object.keys(this.idxMap).length);

        let kv: KeyVal;
        if(idx <= HeaderTable.staticSize)
            kv = HeaderTable.staticTable.idxMap[idx - 1];
        else
            kv = this.idxMap[(idx - HeaderTable.staticSize) - 1]
        //BayServer.info("Header table get(" + idx + ")->(" + kv.name + "," + kv.value + ")");
        return kv;
    }

    getIdxList(name: string): number[] {
        let dynamicList: number[] = this.nameMap.get(name)
        let staticList: number[] = HeaderTable.staticTable.nameMap.get(name)

        let idxList: number[] = []
        if(staticList != null)
            idxList = [...staticList];
        if(dynamicList != null) {
            for(const idx of dynamicList) {
                let realIndex = this.addCount - idx + HeaderTable.staticSize;
                idxList.push(realIndex);
            }
        }
        //BayServer.info("Header table get(" + name + ")->" + idxList);
        return idxList;
    }

    insert(name: string, value: string): void {
        this.idxMap.unshift(new KeyVal(name, value));
        this.addCount++;
        this.addToNameMap(name, this.addCount);
    }

    private put(idx: number, name: string, value: string): void {
        if(idx != Object.keys(this.idxMap).length + 1)
            throw new Error("Illagel State");
        this.idxMap.push(new KeyVal(name, value));
        this.addToNameMap(name, idx);
    }

    setSize(size: number) {

    }

    private addToNameMap(name: string, idx: number): void {
        let idxList: number[] = this.nameMap.get(name);
        if(idxList == null) {
            idxList = [];
            this.nameMap[name] = idxList
        }
        idxList.push(idx);
    }

    static createDynamicTable(): HeaderTable {
        return new HeaderTable()
    }

    static initStaticTable() {
        this.staticTable.put(1, this.PSEUDO_HEADER_AUTHORITY, "");
        this.staticTable.put(2, this.PSEUDO_HEADER_METHOD, "GET");
        this.staticTable.put(3, this.PSEUDO_HEADER_METHOD, "POST");
        this.staticTable.put(4, this.PSEUDO_HEADER_PATH, "/");
        this.staticTable.put(5, this.PSEUDO_HEADER_PATH, "/index.html");
        this.staticTable.put(6, this.PSEUDO_HEADER_SCHEME, "http");
        this.staticTable.put(7, this.PSEUDO_HEADER_SCHEME, "https");
        this.staticTable.put(8, this.PSEUDO_HEADER_STATUS, "200");
        this.staticTable.put(9, this.PSEUDO_HEADER_STATUS, "204");
        this.staticTable.put(10, this.PSEUDO_HEADER_STATUS, "206");
        this.staticTable.put(11, this.PSEUDO_HEADER_STATUS, "304");
        this.staticTable.put(12, this.PSEUDO_HEADER_STATUS, "400");
        this.staticTable.put(13, this.PSEUDO_HEADER_STATUS, "404");
        this.staticTable.put(14, this.PSEUDO_HEADER_STATUS, "500");
        this.staticTable.put(15, "accept-charset", "");
        this.staticTable.put(16, "accept-encoding", "gzip, deflate");
        this.staticTable.put(17, "accept-language", "");
        this.staticTable.put(18, "accept-ranges", "");
        this.staticTable.put(19, "accept", "");
        this.staticTable.put(20, "access-control-allow-origin", "");
        this.staticTable.put(21, "age", "");
        this.staticTable.put(22, "allow", "");
        this.staticTable.put(23, "authorization", "");
        this.staticTable.put(24, "cache-control", "");
        this.staticTable.put(25, "content-disposition", "");
        this.staticTable.put(26, "content-encoding", "");
        this.staticTable.put(27, "content-language", "");
        this.staticTable.put(28, "content-length", "");
        this.staticTable.put(29, "content-location", "");
        this.staticTable.put(30, "content-range", "");
        this.staticTable.put(31, "content-type", "");
        this.staticTable.put(32, "cookie", "");
        this.staticTable.put(33, "date", "");
        this.staticTable.put(34, "etag", "");
        this.staticTable.put(35, "expect", "");
        this.staticTable.put(36, "expires", "");
        this.staticTable.put(37, "from", "");
        this.staticTable.put(38, "host", "");
        this.staticTable.put(39, "if-match", "");
        this.staticTable.put(40, "if-modified-since", "");
        this.staticTable.put(41, "if-none-match", "");
        this.staticTable.put(42, "if-range", "");
        this.staticTable.put(43, "if-unmodified-since", "");
        this.staticTable.put(44, "last-modified", "");
        this.staticTable.put(45, "link", "");
        this.staticTable.put(46, "location", "");
        this.staticTable.put(47, "max-forwards", "");
        this.staticTable.put(48, "proxy-authenticate", "");
        this.staticTable.put(49, "proxy-authorization", "");
        this.staticTable.put(50, "range", "");
        this.staticTable.put(51, "referer", "");
        this.staticTable.put(52, "refresh", "");
        this.staticTable.put(53, "retry-after", "");
        this.staticTable.put(54, "server", "");
        this.staticTable.put(55, "set-cookie", "");
        this.staticTable.put(56, "strict-transport-security", "");
        this.staticTable.put(57, "transfer-encoding", "");
        this.staticTable.put(58, "user-agent", "");
        this.staticTable.put(59, "vary", "");
        this.staticTable.put(60, "via", "");
        this.staticTable.put(61, "www-authenticate", "");

        this.staticSize = this.staticTable.idxMap.length;

    }

}

HeaderTable.initStaticTable()