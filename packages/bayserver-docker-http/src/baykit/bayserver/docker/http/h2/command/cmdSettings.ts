import {H2Command} from "../h2Command";
import {H2CommandHandler} from "../h2CommandHandler";
import {H2Flags} from "../h2Flags";
import {H2Type} from "../h2Type";
import {H2Packet} from "../h2Packet";

export class CmdSettingsItem {
    id: number
    value: number

    constructor(id: number, value: number) {
        this.id = id
        this.value = value
    }
}
export class CmdSettings extends H2Command {

    static readonly HEADER_TABLE_SIZE = 0x1;
    static readonly ENABLE_PUSH = 0x2;
    static readonly MAX_CONCURRENT_STREAMS = 0x3;
    static readonly INITIAL_WINDOW_SIZE = 0x4;
    static readonly MAX_FRAME_SIZE = 0x5;
    static readonly MAX_HEADER_LIST_SIZE = 0x6;

    static readonly INIT_HEADER_TABLE_SIZE = 4096;
    static readonly INIT_ENABLE_PUSH = 1;
    static readonly INIT_MAX_CONCURRENT_STREAMS = -1;
    static readonly INIT_INITIAL_WINDOW_SIZE = 65535;
    static readonly INIT_MAX_FRAME_SIZE = 16384;
    static readonly INIT_MAX_HEADER_LIST_SIZE = -1;

    items: CmdSettingsItem[] = []

    constructor(streamId: number, flags: H2Flags = null) {
        super(H2Type.SETTINGS, streamId, flags);
    }


    unpack(pkt: H2Packet) {
        super.unpack(pkt);
        if(this.flags.ack()) {
            return;
        }

        let acc = pkt.newDataAccessor();
        let pos = 0;
        while(pos < pkt.dataLen()) {
            let id = acc.getShort();
            let value = acc.getInt();
            this.items.push(new CmdSettingsItem(id, value));
            pos += 6;
        }
    }

    pack(pkt: H2Packet) {
        if(this.flags.ack()) {
            // not pack payload
        }
        else {
            let acc = pkt.newDataAccessor();
            for (const item of this.items) {
                acc.putShort(item.id);
                acc.putInt(item.value);
            }
        }

        super.pack(pkt);
    }

    handle(handler: H2CommandHandler): number {
        return handler.handleSettings(this);
    }

}