import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";
import {FcgCommandHandler} from "./fcgCommandHandler";

export interface FcgHandler extends FcgCommandHandler {

    /**
     * Send protocol error to client
     */
    onProtocolError(e: ProtocolException) : boolean;
}