import {Reusable} from "./Reusable";
import {Valve} from "./valve";
import {Buffer} from "buffer";

export interface Postman extends Reusable, Valve {
    post(buf: Buffer, adr, tag: any, listener: () => void) : void;

    flush(): void;

    postEnd(): void;

    isZombie(): boolean;

    abort(): void;
}