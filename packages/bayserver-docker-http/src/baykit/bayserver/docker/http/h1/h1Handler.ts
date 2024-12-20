import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {H1CommandHandler} from "./h1CommandHandler";

export interface H1Handler extends H1CommandHandler {

    /**
     * Send protocol error to client
     */
    onProtocolError(e: ProtocolException) : boolean;
}