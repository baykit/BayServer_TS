import {SignalHandler} from "./signalHandler";

export class SignalProxy {

    static getProxy() {
        return new SignalProxy();
    }

    register(sig: string, handler: SignalHandler) {
        process.on(sig, () => {
            handler()
        })
    }
}