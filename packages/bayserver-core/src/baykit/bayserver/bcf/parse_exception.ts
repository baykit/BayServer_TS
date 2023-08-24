import { ConfigException } from "../configException";

export class ParseException extends ConfigException {

    public constructor(file: string, line: number, message: string) {
        super(file, line, message);
    }
}
