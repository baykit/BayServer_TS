import {Transporter} from "./transporter";

export class PlainTransporter extends Transporter {

    protected secure(): boolean {
        return false;
    }

    public constructor(serverMode: boolean, bufsiz: number, writeOnly: boolean = false) {
        super(serverMode, false, writeOnly);
    }
}