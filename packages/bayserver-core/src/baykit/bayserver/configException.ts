import { BayException } from "./bayException";

export class ConfigException extends BayException{

    public file: string;
    public line: number;

    public constructor(file: string, line: number, fmt: string, ...args: any[]) {
        super(fmt + ConfigException.createFileLine(file, line), ...args);
    }

    /**
     * Utility method
     */
    public static createFileLine(file: string, line: number): string {
        return " (" + file + ":" + line + ")";
    }

}
