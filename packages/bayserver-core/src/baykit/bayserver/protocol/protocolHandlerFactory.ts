import {PacketStore} from "./packetStore";
import {Command} from "./command";
import {Packet} from "./packet";
import {ProtocolHandler} from "./protocolHandler";

export interface ProtocolHandlerFactory<C extends Command<C, P, any>, P extends Packet> {

    createProtocolHandler(pktStore: PacketStore<P>): ProtocolHandler<C, P>;
}