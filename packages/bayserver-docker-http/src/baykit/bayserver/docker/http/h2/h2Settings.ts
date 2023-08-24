export class H2Settings {

    static readonly DEFAULT_HEADER_TABLE_SIZE: number = 4096;
    static readonly DEFAULT_ENABLE_PUSH: boolean = true;
    static readonly DEFAULT_MAX_CONCURRENT_STREAMS: number = -1;
    static readonly DEFAULT_MAX_WINDOW_SIZE: number = 65535;
    static readonly DEFAULT_MAX_FRAME_SIZE: number = 16384;
    static readonly DEFAULT_MAX_HEADER_LIST_SIZE: number = -1;

    headerTableSize: number
    enablePush: boolean
    maxConcurrentStreams: number
    initialWindowSize: number
    maxFrameSize: number
    maxHeaderListSize: number

    constructor() {
        this.reset()
    }

    reset(): void {
        this.headerTableSize = H2Settings.DEFAULT_HEADER_TABLE_SIZE
        this.enablePush = H2Settings.DEFAULT_ENABLE_PUSH;
        this.maxConcurrentStreams = H2Settings.DEFAULT_MAX_CONCURRENT_STREAMS;
        this.initialWindowSize = H2Settings.DEFAULT_MAX_WINDOW_SIZE;
        this.maxFrameSize = H2Settings.DEFAULT_MAX_FRAME_SIZE;
        this.maxHeaderListSize = H2Settings.DEFAULT_MAX_HEADER_LIST_SIZE;
    }
}