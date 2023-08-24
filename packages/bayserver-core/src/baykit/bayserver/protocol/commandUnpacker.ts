import {Packet} from "./packet";
import {Reusable} from "../util/Reusable";

export abstract class CommandUnPacker<P extends Packet> implements Reusable {

    public abstract packetReceived(pkt: P) : number;

    abstract reset();
}
