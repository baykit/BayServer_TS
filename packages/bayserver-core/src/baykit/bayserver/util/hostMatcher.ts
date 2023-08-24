export class HostMatcher {
    static readonly MATCH_TYPE_ALL = 1
    static readonly MATCH_TYPE_EXACT = 2
    static readonly MATCH_TYPE_DOMAIN = 3

    type: number
    host: string
    domain: string

    constructor(host: string) {
        if(host == "*") {
            this.type = HostMatcher.MATCH_TYPE_ALL
        }
        else if(host.startsWith("*.")) {
            this.type = HostMatcher.MATCH_TYPE_DOMAIN
            this.domain = host.substring(2)
        }
        else {
            this.type = HostMatcher.MATCH_TYPE_EXACT
            this.host = host
        }
    }

    match(remoteHost: string): boolean {
        if (this.type == HostMatcher.MATCH_TYPE_ALL) {
            // all match
            return true;
        }
        if (remoteHost == null) {
            return false;
        }

        if (this.type == HostMatcher.MATCH_TYPE_EXACT) {
            // exact match
            return remoteHost == this.host;
        }
        else {
            // domain match
            return remoteHost.endsWith(this.domain);
        }
    }
}