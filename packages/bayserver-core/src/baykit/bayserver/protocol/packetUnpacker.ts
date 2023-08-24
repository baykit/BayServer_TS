import {Packet} from "./packet";
import {Reusable} from "../util/Reusable";
import {Buffer} from "buffer";

export abstract class PacketUnpacker<P extends Packet> implements Reusable {

    public abstract bytesReceived(bytes: Buffer): number;

    abstract reset()
}
