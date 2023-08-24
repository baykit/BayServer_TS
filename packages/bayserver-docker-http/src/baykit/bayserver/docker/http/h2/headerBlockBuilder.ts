import {HeaderTable} from "./headerTable";
import {HeaderBlock} from "./headerBlock";

export class HeaderBlockBuilder {
    buildHeaderBlock(name: string, value: string, tbl: HeaderTable) {
        let idxList = tbl.getIdxList(name);

        let blk: HeaderBlock = null;
        for(const idx of idxList) {
            let kv = tbl.get(idx);
            if(kv != null && value == kv.value) {
                blk = new HeaderBlock();
                blk.op = HeaderBlock.INDEX;
                blk.index = idx;
                break;
            }
        }
        if(blk == null) {
            blk = new HeaderBlock();
            if (idxList.length > 0) {
                blk.op = HeaderBlock.KNOWN_HEADER;
                blk.index = idxList[0];
                blk.value = value;
            } else {
                blk.op = HeaderBlock.UNKNOWN_HEADER;
                blk.name = name;
                blk.value = value;
            }
        }

        return blk;
    }

    buildStatusBlock(status: number, tbl: HeaderTable): HeaderBlock {
        let stIndex = -1;

        let statusIndexList = tbl.getIdxList(":status");
        for(const index of statusIndexList) {
            let kv = tbl.get(index);
            if(kv != null &&  status == Number.parseInt(kv.value)) {
                stIndex = index;
                break;
            }
        }

        let blk = new HeaderBlock();
        if(stIndex != -1) {
            blk.op = HeaderBlock.INDEX;
            blk.index = stIndex;
        }
        else {
            blk.op = HeaderBlock.KNOWN_HEADER;
            blk.index = statusIndexList[0];
            blk.value = status.toString();
        }

        return blk;
    }
}