import exp = require("constants");
import {Server} from "net";
import {Port} from "../docker/port";
import {Docker} from "../docker/docker";

export class PortMapItem
{
    public ch: Server;
    public docker: Port;

    public constructor(ch: Server, docker: Port) {
        this.ch = ch
        this.docker = docker
    }

    public static findDocker(ch: Server, map: PortMapItem[]): Port
    {
        for(const item of map) {
            if(item.ch === ch)
            return item.docker;
        }
        return null;
    }
}