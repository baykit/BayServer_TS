import * as net from "net";
import {Transporter} from "../agent/multiplexer/transporter";
import {Ship} from "../ship/ship";

export interface Secure {
    setAppProtocols(protocols: string[]): void;

    reloadCert(): void;

    newTransporter(agtId: number, ship: Ship): Transporter;

    createServer(): net.Server

    createTlsSocket(ch: net.Socket, server: net.Server): net.Socket
}