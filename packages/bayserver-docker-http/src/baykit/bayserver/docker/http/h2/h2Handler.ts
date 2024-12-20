import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {H2CommandHandler} from "./h2CommandHandler";

export interface H2Handler extends H2CommandHandler {

    /**
     * Send protocol error to client
     */
    onProtocolError(e: ProtocolException) : boolean;
}