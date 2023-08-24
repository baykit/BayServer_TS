import {HeaderBlock} from "./headerBlock";
import {HeaderTable} from "./headerTable";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";

export class HeaderBlockAnalyzer {
    name: string = null
    value: string = null
    method: string = null
    path: string = null
    scheme: string = null
    status: string = null

    clear(): void {
        this.name = null;
        this.value = null;
        this.method = null;
        this.path = null;
        this.scheme = null;
        this.status = null;
    }

    analyzeHeaderBlock(blk: HeaderBlock, tbl: HeaderTable) {
        this.clear();
        switch(blk.op) {
            case HeaderBlock.INDEX: {
                let kv = tbl.get(blk.index);
                if(kv == null)
                    throw new ProtocolException("Invalid header index: " + blk.index);
                this.name = kv.name;
                this.value = kv.value;
                break;
            }

            case HeaderBlock.KNOWN_HEADER:
            case HeaderBlock.OVERLOAD_KNOWN_HEADER: {
                let kv = tbl.get(blk.index);
                if(kv == null)
                    throw new ProtocolException("Invalid header index: " + blk.index);
                this.name = kv.name;
                this.value = blk.value;
                if(blk.op == HeaderBlock.OVERLOAD_KNOWN_HEADER)
                    tbl.insert(this.name, this.value);
                break;
            }

            case HeaderBlock.NEW_HEADER: {
                this.name = blk.name;
                this.value = blk.value;
                tbl.insert(this.name, this.value);
                break;
            }

            case HeaderBlock.UNKNOWN_HEADER: {
                this.name = blk.name;
                this.value = blk.value;
                break;
            }

            case HeaderBlock.UPDATE_DYNAMIC_TABLE_SIZE: {
                tbl.setSize(blk.size);
                break;
            }

            default:
                throw new Error("Illegal State");
        }

        if(this.name != null && this.name[0] == ':') {
            switch(this.name) {
                case HeaderTable.PSEUDO_HEADER_AUTHORITY:
                    this.name = "host";
                    break;

                case HeaderTable.PSEUDO_HEADER_METHOD:
                    this.method = this.value;
                    break;

                case HeaderTable.PSEUDO_HEADER_PATH:
                    this.path = this.value;
                    break;

                case HeaderTable.PSEUDO_HEADER_SCHEME:
                    this.scheme = this.value;
                    break;

                case HeaderTable.PSEUDO_HEADER_STATUS:
                    this.status = this.value;
            }
        }
    }

    
}