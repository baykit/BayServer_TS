export class H2Flags {

    static readonly FLAGS_NONE = 0x0;
    static readonly FLAGS_ACK = 0x1;
    static readonly FLAGS_END_STREAM = 0x1;
    static readonly FLAGS_END_HEADERS = 0x4;
    static readonly FLAGS_PADDED = 0x8;
    static readonly FLAGS_PRIORITY = 0x20;

    flags: number

    constructor(flags=H2Flags.FLAGS_NONE) {
        this.flags = flags
    }

    toString(): string {
        return this.flags.toString()
    }

    hasFlag(flag: number): boolean {
        return (this.flags & flag) != 0
    }

    setFlag(flag: number, val: boolean) {
        if(val)
            this.flags |= flag
        else
            this.flags &= ~flag
    }

    ack(): boolean {
        return this.hasFlag(H2Flags.FLAGS_ACK)
    }

    setAck(isAck: boolean) {
        this.setFlag(H2Flags.FLAGS_ACK, isAck)
    }

    endStream(): boolean {
        return this.hasFlag(H2Flags.FLAGS_END_STREAM)
    }

    setEndStream(isEndStream: boolean) {
        this.setFlag(H2Flags.FLAGS_END_STREAM, isEndStream)
    }

    endHeaders(): boolean {
        return this.hasFlag(H2Flags.FLAGS_END_HEADERS)
    }

    setEndHeaders(isEndHeaders) {
        this.setFlag(H2Flags.FLAGS_END_HEADERS, isEndHeaders)
    }

    padded(): boolean {
        return this.hasFlag(H2Flags.FLAGS_PADDED)
    }

    setPadded(isPadded: boolean) {
        this.setFlag(H2Flags.FLAGS_PADDED, isPadded)
    }

    priority(): boolean {
        return this.hasFlag(H2Flags.FLAGS_PRIORITY)
    }

    setPriority(isPriority) {
        this.setFlag(H2Flags.FLAGS_PRIORITY, isPriority)
    }
}