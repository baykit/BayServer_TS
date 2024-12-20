import {City} from "./city";
import {ProtocolHandler} from "../protocol/protocolHandler";
import {InboundShip} from "../common/inboundShip";
import * as net from "net";
import {Secure} from "./Secure";
import {Rudder} from "../rudder/rudder";

export interface Port {

    protocol(): string;

    getHost(): string;

    getPort(): number;

    getSocketPath(): string;

    getAddress(): string;

    isAnchored(): boolean;

    isSecure(): boolean;

    getTimeoutSec(): number

    checkAdmitted(rd: Rudder): void;

    getAdditionalHeaders(): string[][];

    getCities(): City[]

    findCity(name: string): City;

    onConnected(agentId: number, clientRd: Rudder, serverRd: Rudder): void;

    returnProtocolHandler(agentId: number,  protoHnd: ProtocolHandler<any, any>): void;

    returnShip(ship: InboundShip): void;

    createServer(): net.Server;

    getSecure(): Secure;
}