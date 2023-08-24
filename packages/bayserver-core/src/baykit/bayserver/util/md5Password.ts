import * as crypto from "crypto";

export class Md5Password {

    static encode(password: string) : string {
        let hash = crypto.createHash('md5');
        return hash.update(password).digest('hex');
    }

}