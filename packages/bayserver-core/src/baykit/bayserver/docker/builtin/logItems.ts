import {LogItem} from "./logItem";
import {Tour} from "../../tour/tour";

export class TextItem extends LogItem {

    /** text to print */
    text: string

    constructor(text: string) {
        super()
        this.text = text;
    }

    getItem(tour: Tour): string {
        return this.text;
    }
}

/**
 * Return null result
 */
export class NullItem extends LogItem {

    static factory = () => new NullItem()

    getItem(tour: Tour): string {
        return null;
    }
}

/**
 * Return remote IP address (%a)
 */
export class RemoteHostItem extends LogItem {

    static factory = () => new RemoteHostItem()

    getItem(tour: Tour): string {
        return tour.req.remoteAddress;
    }
}

/**
 * Return local IP address (%A)
 */
export class ServerIpItem extends LogItem {

    static factory = () => new ServerIpItem()

    getItem(tour: Tour): string {
        return tour.req.serverAddress;
    }
}

/**
 * Return number of bytes that is sent from clients (Except HTTP headers)
 * (%B)
 */
export class RequestBytesItem1 extends LogItem {

    static factory = () => new RequestBytesItem1()

    getItem(tour: Tour): string {
        let bytes = tour.req.headers.contentLength();
        if (bytes < 0)
            bytes = 0;
        return String(bytes);
    }
}

/**
 * Return number of bytes that is sent from clients in CLF format (Except
 * HTTP headers) (%b)
 */
export class RequestBytesItem2 extends LogItem {

    static factory = () => new RequestBytesItem2()

    getItem(tour: Tour): string {
        let bytes = tour.req.headers.contentLength();
        if (bytes <= 0)
            return "-";
        else
            return String(bytes);
    }
}


/**
 * Return connection status (%c)
 */
export class ConnectionStatusItem extends LogItem {

    static factory = () => new ConnectionStatusItem()

    getItem(tour: Tour): string {
        if (tour.isAborted())
            return "X";
        else
            return "-";
    }
}

/**
 * Return file name (%f)
 */
export class FileNameItem extends LogItem {

    static factory = () => new FileNameItem()

    getItem(tour: Tour): string {
        return tour.req.scriptName;
    }
}

/**
 * Return remote log name (%l)
 */
export class RemoteLogItem extends LogItem {

    static factory = () => new RemoteLogItem()

    getItem(tour: Tour): string {
        return null;
    }
}

/**
 * Return request protocol (%m)
 */
export class ProtocolItem extends LogItem {

    static factory = () => new ProtocolItem()

    getItem(tour: Tour): string {
        return tour.req.protocol
    }
}

/**
 * Return requested header (%{Foobar}i)
 */
export class RequestHeaderItem extends LogItem {

    static factory = () => new RequestHeaderItem()

    /** Header name */
    name: string;

    init(param: string): void {
        if (param == null)
            param = "";
        this.name = param;
    }

    getItem(tour: Tour): string {
        return tour.req.headers.get(this.name);
    }
}


/**
 * Return request method (%m)
 */
export class MethodItem extends LogItem {

    static factory = () => new MethodItem()

    getItem(tour: Tour): string {
        return tour.req.method
    }
}

/**
 * Return responde header (%{Foobar}o)
 */
export class ResponseHeaderItem extends LogItem {

    static factory = () => new ResponseHeaderItem()

    /** Header name */
    name: string;

    init(param: string): void {
        if (param == null)
            param = "";
        this.name = param;
    }


    getItem(tour: Tour): string {
        return tour.res.headers.get(this.name)
    }
}

/**
 * The server port (%p)
 */
export class PortItem extends LogItem {

    static factory = () => new PortItem()

    getItem(tour: Tour): string {
        return String(tour.req.serverPort)
    }
}

/**
 * Return query string (%q)
 */
export class QueryStringItem extends LogItem {

    static factory = () => new QueryStringItem()

    getItem(tour: Tour): string {
        let qStr = tour.req.queryString;
        if (qStr != null)
            return '?' + qStr;
        else
            return null;
    }
}

/**
 * The start line (%r)
 */
export class StartLineItem extends LogItem {

    static factory = () => new StartLineItem()

    getItem(tour: Tour): string {
        return tour.req.method+ " " + tour.req.uri + " " + tour.req.protocol
    }
}

/**
 * Return status (%s)
 */
export class StatusItem extends LogItem {

    static factory = () => new StatusItem()

    getItem(tour: Tour): string {
        return String(tour.res.headers.status)
    }
}

/**
 * Return current time (%{format}t)
 */
export class TimeItem extends LogItem {

    static factory = () => new TimeItem()

    init(param: string | null): void {
    }

    getItem(tour: Tour): string {
        return "[" + new Date().toLocaleString() + "]"
    }
}

/**
 * Return how long request took (%T)
 */
export class IntervalItem extends LogItem {

    static factory = () => new IntervalItem()

    getItem(tour: Tour): string {
        return String(tour.interval / 1000)
    }
}

/**
 * Return remote user (%u)
 */
export class RemoteUserItem extends LogItem {

    static factory = () => new RemoteUserItem()

    getItem(tour: Tour): string {
        return tour.req.remoteUser
    }
}

/**
 * Return requested URL(not content query string) (%U)
 */
export class RequestUrlItem extends LogItem {

    static factory = () => new RequestUrlItem()

    getItem(tour: Tour): string {
        let url = tour.req.uri== null ? "" : tour.req.uri;
        let pos = url.indexOf('?');
        if (pos != -1)
            url = url.substring(0, pos);
        return url;
    }
}

/**
 * Return the server name (%v)
 */
export class ServerNameItem extends LogItem {

    static factory = () => new ServerNameItem()

    getItem(tour: Tour): string {
        return tour.req.serverName
    }
}
