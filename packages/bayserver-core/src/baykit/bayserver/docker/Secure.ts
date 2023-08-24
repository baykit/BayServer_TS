import {Transporter} from "../agent/transporter/transporter";
import * as net from "net";

export interface Secure {
    setAppProtocols(protocols: string[]);

    reloadCert();

    createTransporter(): Transporter;

    createServer(): net.Server

    createTlsSocket(ch: net.Socket, server: net.Server): net.Socket
}