import {Boat} from "../../watercraft/boat";
import {Postman} from "../../util/postman";
import {Reusable} from "../../util/Reusable";
import {BayLog} from "../../bayLog";
import * as os from "os";

export class LogBoat extends Boat implements Reusable{

    private fileName: string
    private postman: Postman

    toString(): string {
        return "lboat#" + this.boatId + "/" + this.objectId + " file=" +  this.fileName;
    }

    ////////////////////////////////////////////////////////////////////
    // Implements Reusable
    ////////////////////////////////////////////////////////////////////

    reset(): void {
        this.fileName = null;
        this.postman = null;
    }

    ////////////////////////////////////////////////////////////////////
    // Implements DataListener
    ////////////////////////////////////////////////////////////////////
    notifyClose(): void {
    }

    notifyError(err: Error): void {
        BayLog.error_e(err)
    }

    ////////////////////////////////////////////////////////////////////
    // Custom methods
    ////////////////////////////////////////////////////////////////////
    initBoat(filename: string, postman: Postman) {
        super.init()
        this.fileName = filename
        this.postman = postman
    }

    log(data: string | null) {
        if(data == null)
            data = ""
        let buf = Buffer.from(data + os.EOL)
        this.postman.post(buf, null, this.fileName, null)
    }
}