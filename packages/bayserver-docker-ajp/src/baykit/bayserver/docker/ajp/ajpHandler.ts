import {AjpCommandHandler} from "./ajpCommandHandler";
import {ProtocolException} from "bayserver-core/baykit/bayserver/protocol/protocolException";

export interface AjpHandler extends AjpCommandHandler {

    onProtocolError(e: ProtocolException): boolean
}