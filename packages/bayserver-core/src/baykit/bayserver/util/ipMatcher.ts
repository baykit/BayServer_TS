import * as net from "net";
import {BayMessage} from "../bayMessage";
import {Symbol} from "../symbol";
import {BayException} from "../bayException";

export class IpMatcher {
    matchAll: boolean
    netAdr: number[]

    maskAdr: number[]

    constructor(ipDesc: string) {
        if(ipDesc == "*")
            this.matchAll = true
        else {
            this.matchAll = false
            this.parseIp(ipDesc)
        }
    }

    match(adr: string) {
        if (this.matchAll)
            return true;

        let remoteAdr: number[] = IpMatcher.getIpAddress(adr)

        if (remoteAdr.length != this.maskAdr.length)
            return false;  // IPv4 and IPv6 don't match each other

        for (let i = 0; i < remoteAdr.length; i++) {
            if ((remoteAdr[i] & this.maskAdr[i]) != this.netAdr[i])
                return false;
        }
        return true;
    }

    parseIp(ipDesc: string) {
        let ipList = ipDesc.split("/")
        let ip: string, mask: string;
        if (ipList.length == 0)
            throw new BayException(BayMessage.get(Symbol.CFG_INVALID_IP_DESC, ipDesc));

        ip = ipList[0]
        if(ipList.length == 1)
            mask = "255.255.255.255";
        else
            mask = ipList[1];

        let ipAdr = IpMatcher.getIpAddress(ip);
        this.maskAdr = IpMatcher.getIpAddress(mask);
        if (ipAdr.length != this.maskAdr.length) {
            throw new BayException(
                BayMessage.get(Symbol.CFG_IPV4_AND_IPV6_ARE_MIXED, ipDesc));
        }

        this.netAdr = []
        for (let i = 0; i < this.maskAdr.length; i++)
            this.netAdr[i] =  (ipAdr[i] & this.maskAdr[i]);
    }

    static getIpAddress(adr: string): number[] {
        let ipv6 = false
        if(adr.indexOf(":") >= 0) {
            if(adr.indexOf(".") > 0) {
                if(!adr.startsWith("::ffff:"))
                    throw new BayException("Invalid IP address: " + adr)
                adr = adr.substring(7)
            }
            else {
                ipv6 = true
            }
        }
        let sadr = new net.SocketAddress({address: adr, family: ipv6 ? "ipv6" : "ipv4"})

        if(ipv6) {

            let parts = adr.split("::")
            if(parts.length > 2 || parts.length == 0)
                throw new BayException("Invalid IPv6 address: " + adr)
            if(parts.length == 1)
                return this.parseIPv6Part(parts[0])
            else {
                let frontPart = this.parseIPv6Part(parts[0])
                let backPart = this.parseIPv6Part(parts[1])

                while(frontPart.length + backPart.length < 16)
                    frontPart.push(0)
                return [...frontPart, ...backPart]
            }
        }
        else {
            return adr.split(".").map((item) => {
                return Number.parseInt(item)})
        }
    }

    static parseIPv6Part(part: string): number[] {
        let items = part.split(":")
        let address: number[] = []
        for(const item of items) {
            if(item == "")
                continue
            let val = Number.parseInt(item, 16)
            address.push(val >> 8)
            address.push(val & 0xff)
        }
        return address
    }

}