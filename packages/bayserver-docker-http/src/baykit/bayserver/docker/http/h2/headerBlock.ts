/**
 * HPack
 *   https://datatracker.ietf.org/doc/html/rfc7541
 *
 *
 */
import {H2DataAccessor} from "./h2Packet";

export class HeaderBlock {
    static readonly INDEX = 1
    static readonly OVERLOAD_KNOWN_HEADER = 2
    static readonly NEW_HEADER = 3
    static readonly KNOWN_HEADER = 4
    static readonly UNKNOWN_HEADER = 5
    static readonly UPDATE_DYNAMIC_TABLE_SIZE = 6

    op: number
    index: number
    name: string
    value: string
    size: number

    toString(): string {
        return this.op + " index=" + this.index + " name=" + this.name + " value=" + this.value + " size=" + this.size;
    }

    static pack(blk: HeaderBlock, acc: H2DataAccessor) {
        switch(blk.op) {
            case this.INDEX: {
                acc.putHPackInt(blk.index, 7, 1);
                break;
            }
            case this.OVERLOAD_KNOWN_HEADER: {
                throw new Error("Illegal State");
            }
            case this.NEW_HEADER: {
                throw new Error("Illegal State");
            }
            case this.KNOWN_HEADER: {
                acc.putHPackInt(blk.index, 4, 0);
                acc.putHPackString(blk.value, false);
                break;
            }
            case this.UNKNOWN_HEADER: {
                acc.putByte(0);
                acc.putHPackString(blk.name, false);
                acc.putHPackString(blk.value, false);
                break;
            }
            case this.UPDATE_DYNAMIC_TABLE_SIZE: {
                throw new Error("Illegal State");
            }
        }
    }

    static unpack(acc: H2DataAccessor): HeaderBlock {
        let blk = new HeaderBlock();
        let index = acc.getByte();
        //BayServer.debug("index: " + index);
        let indexHeaderField = (index & 0x80) != 0;
        if(indexHeaderField) {
            // index header field
            /**
             *   0   1   2   3   4   5   6   7
             * +---+---+---+---+---+---+---+---+
             * | 1 |        Index (7+)         |
             * +---+---------------------------+
             */
            blk.op = HeaderBlock.INDEX
            blk.index = index & 0x7F;
        }
        else {
            // literal header field
            let updateIndex = (index & 0x40) != 0;
            if(updateIndex) {
                index = index & 0x3F;
                let overloadIndex = index != 0;
                if(overloadIndex) {
                    // known header name
                    if(index == 0x3F) {
                        index = index + acc.getHPackIntRest();
                    }
                    blk.op = HeaderBlock.OVERLOAD_KNOWN_HEADER;
                    blk.index = index;

                    /**
                     *      0   1   2   3   4   5   6   7
                     *    +---+---+---+---+---+---+---+---+
                     *    | 0 | 1 |      Index (6+)       |
                     *    +---+---+-----------------------+
                     *    | H |     Value Length (7+)     |
                     *    +---+---------------------------+
                     *    | Value String (Length octets)  |
                     *    +-------------------------------+
                     */
                    blk.value = acc.getHPackString();
                }
                else {
                    // new header name
                    /**
                     *   0   1   2   3   4   5   6   7
                     * +---+---+---+---+---+---+---+---+
                     * | 0 | 1 |           0           |
                     * +---+---+-----------------------+
                     * | H |     Name Length (7+)      |
                     * +---+---------------------------+
                     * |  Name String (Length octets)  |
                     * +---+---------------------------+
                     * | H |     Value Length (7+)     |
                     * +---+---------------------------+
                     * | Value String (Length octets)  |
                     * +-------------------------------+
                     */
                    blk.op = HeaderBlock.NEW_HEADER;
                    blk.name = acc.getHPackString();
                    blk.value = acc.getHPackString();
                }
            }
            else {
                let updateDynamicTableSize = (index & 0x20) != 0;
                if(updateDynamicTableSize) {
                    /**
                     *   0   1   2   3   4   5   6   7
                     * +---+---+---+---+---+---+---+---+
                     * | 0 | 0 | 1 |   Max size (5+)   |
                     * +---+---------------------------+
                     */
                    let size = index & 0x1f;
                    if(size == 0x1f) {
                        size = size + acc.getHPackIntRest();
                    }
                    blk.op = HeaderBlock.UPDATE_DYNAMIC_TABLE_SIZE;
                    blk.size = size;
                }
                else {
                    // not update index
                    index = (index & 0xF);
                    if (index != 0) {
                        /**
                         *   0   1   2   3   4   5   6   7
                         * +---+---+---+---+---+---+---+---+
                         * | 0 | 0 | 0 | 0 |  Index (4+)   |
                         * +---+---+-----------------------+
                         * | H |     Value Length (7+)     |
                         * +---+---------------------------+
                         * | Value String (Length octets)  |
                         * +-------------------------------+
                         *
                         * OR
                         *
                         *   0   1   2   3   4   5   6   7
                         * +---+---+---+---+---+---+---+---+
                         * | 0 | 0 | 0 | 1 |  Index (4+)   |
                         * +---+---+-----------------------+
                         * | H |     Value Length (7+)     |
                         * +---+---------------------------+
                         * | Value String (Length octets)  |
                         * +-------------------------------+
                         */
                        if (index == 0xF) {
                            index = index + acc.getHPackIntRest();
                        }
                        blk.op = HeaderBlock.KNOWN_HEADER;
                        blk.index = index;
                        blk.value = acc.getHPackString();
                    } else {
                        // literal header field
                        /**
                         *   0   1   2   3   4   5   6   7
                         * +---+---+---+---+---+---+---+---+
                         * | 0 | 0 | 0 | 0 |       0       |
                         * +---+---+-----------------------+
                         * | H |     Name Length (7+)      |
                         * +---+---------------------------+
                         * |  Name String (Length octets)  |
                         * +---+---------------------------+
                         * | H |     Value Length (7+)     |
                         * +---+---------------------------+
                         * | Value String (Length octets)  |
                         * +-------------------------------+
                         *
                         * OR
                         *
                         *   0   1   2   3   4   5   6   7
                         * +---+---+---+---+---+---+---+---+
                         * | 0 | 0 | 0 | 1 |       0       |
                         * +---+---+-----------------------+
                         * | H |     Name Length (7+)      |
                         * +---+---------------------------+
                         * |  Name String (Length octets)  |
                         * +---+---------------------------+
                         * | H |     Value Length (7+)     |
                         * +---+---------------------------+
                         * | Value String (Length octets)  |
                         * +-------------------------------+
                         */
                        blk.op = HeaderBlock.UNKNOWN_HEADER;
                        blk.name = acc.getHPackString();
                        blk.value = acc.getHPackString();
                    }
                }
            }
        }
        return blk;
    }
}