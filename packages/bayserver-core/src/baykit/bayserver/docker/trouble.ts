export class TroubleCommand {
    public readonly method: number;
    public readonly target: string;

    public constructor(method: number, target: string) {
        this.method = method;
        this.target = target;
    }
}

export const TROUBLE_METHOD_GUIDE = 1;
export const TROUBLE_METHOD_TEXT = 2;
export const TROUBLE_METHOD_REROUTE = 3;

export interface Trouble {
    find(status: number): TroubleCommand;
}