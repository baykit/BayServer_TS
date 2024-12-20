import {Recipient} from "../../common/recipient";
import {EventEmitter} from "events";
import {BayLog} from "../../bayLog";

export class EventRecipient implements Recipient {

    emitter: EventEmitter = new EventEmitter()
    private static readonly EVENT_NAME = "receive"

    async receive(wait: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            this.emitter.once(EventRecipient.EVENT_NAME, () => {
                //BayLog.debug("Waked up!")
                resolve()
            })
        })
    }

    wakeup(): void {
        this.emitter.emit(EventRecipient.EVENT_NAME)
    }

}