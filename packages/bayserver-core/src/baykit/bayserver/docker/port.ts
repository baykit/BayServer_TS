import {City} from "./city";
import {GrandAgent} from "../agent/grandAgent";
import {Transporter} from "../agent/transporter/transporter";
import {ProtocolHandler} from "../protocol/protocolHandler";
import {InboundShip} from "./base/inboundShip";
import * as net from "net";
import {Secure} from "./Secure";
import {ChannelWrapper} from "../agent/channelWrapper";

export interface Port {

    protocol(): string;

    getHost(): string;

    getPort(): number;

    getSocketPath(): string;

    getAddress(): string;

    isAnchored(): boolean;

    isSecure(): boolean;

    getTimeoutSec(): number

    checkAdmitted(ch);

    getAdditionalHeaders(): string[][];

    getCities(): City[]

    findCity(name: string): City;

    newTransporter(agent: GrandAgent, ch: ChannelWrapper): Transporter;

    returnProtocolHandler(agent: GrandAgent, protoHnd: ProtocolHandler<any, any>);

    returnShip(ship: InboundShip);

    createServer(): net.Server;

    getSecure(): Secure;
}