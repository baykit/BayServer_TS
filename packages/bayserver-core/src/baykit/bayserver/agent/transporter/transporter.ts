import {NonBlockingHandler} from "../nonBlockingHandler";
import {DataListener} from "./dataListener";
import {DataConsumeListener} from "../../util/dataConsumeListener";
import {Sink} from "../../sink";
import {BayLog} from "../../bayLog";
import {IOException} from "../../util/ioException";
import {UpgradeException} from "../upgradeException";
import {ProtocolException} from "../../protocol/protocolException";
import {NextSocketAction} from "../nextSocketAction";
import {Reusable} from "../../util/Reusable";
import {Valve} from "../../util/valve";
import {Postman} from "../../util/postman";
import {ChannelListener} from "../channelListener";
import {ChannelWrapper} from "../channelWrapper";



export abstract class Transporter implements ChannelListener, Reusable, Valve, Postman {
    dataListener: DataListener = null;
    private readonly serverMode: boolean = false;
    private readonly traceSSL: boolean = false;
    protected channel: ChannelWrapper = null;   // socket or file
    protected finale: boolean = false;
    protected initialized: boolean = false;
    protected chValid: boolean = false;
    protected needHandshake: boolean = true;
    nonBlockingHandler: NonBlockingHandler = null;
    tmpAddress = [];

    readBuf: Buffer = null
    writeOnly: boolean

    /////////////////////////////////////////////////////////////////////////////////
    // abstract methods
    /////////////////////////////////////////////////////////////////////////////////

    protected abstract secure(): boolean;



    public constructor(serverMode: boolean, traceSSL: boolean, writeOnly: boolean = false) {
        this.serverMode = serverMode;
        this.traceSSL = traceSSL;
        this.readBuf = Buffer.alloc(8192)
        this.writeOnly = writeOnly
    }

    init(chHnd: NonBlockingHandler, ch: ChannelWrapper, lis: DataListener) {

        if(this.initialized)
            throw new Sink(this + " This transporter is already in use by channel: " + ch);

        this.nonBlockingHandler = chHnd;
        this.dataListener = lis;
        this.channel = ch;
        this.setValid(true);
        this.initialized = true;
        this.nonBlockingHandler.addChannelListener(ch, this)
    }

    toString(): string {
        return "tp[" + this.dataListener + "]";
    }

    //////////////////////////////////////////////////////
    // implements Reusable
    //////////////////////////////////////////////////////
    reset(): void {

        this.finale = false;
        this.initialized = false;
        this.channel = null;
        this.setValid(false);
        this.needHandshake = true;
    }

    //////////////////////////////////////////////////////
    // implements Postman
    //////////////////////////////////////////////////////
    post(buf: Buffer, adr, tag: any, listener: DataConsumeListener): void {
        this.checkInitialized();

        BayLog.debug("%s post: %s len=%d", this, tag, buf.length);

        if (!this.chValid) {
            throw new IOException("Invalid channel");
        }
        else {
            try {
                this.nonBlockingHandler.askToWrite(buf, this.channel, listener)
            }
            catch(e) {
                this.chValid = false
                throw e
            }
        }
    }

    //////////////////////////////////////////////////////
    // implements Valve
    //////////////////////////////////////////////////////
    openValve(): void {
        BayLog.debug("%s resume", this);
        this.nonBlockingHandler.askToRead(this.channel)
    }

    //////////////////////////////////////////////////////
    // implements ChannelListener
    //////////////////////////////////////////////////////
    onConnect(chkCh: ChannelWrapper): number {
        this.checkChannel(chkCh);
        BayLog.trace("%s onConnect", this);

        return this.dataListener.notifyConnect();
    }

    onRead(ch: ChannelWrapper, buf: Buffer): number {
        this.checkChannel(ch);
        BayLog.trace("%s onRead", this);

        if(buf == null || buf.length == 0) {
            return this.dataListener.notifyEof();
        }
        else {
            try {
                return this.dataListener.notifyRead(buf, null);
            }
            catch(e) {
                if(e instanceof UpgradeException) {
                    BayLog.debug("%s Protocol upgrade", this.dataListener);
                    return this.dataListener.notifyRead(buf, null);
                }
                else if (e instanceof ProtocolException) {
                    let close: boolean = this.dataListener.notifyProtocolError(e);
                    if(!close && this.serverMode)
                        return NextSocketAction.CONTINUE;
                    else
                        return NextSocketAction.CLOSE;
                }
                else if (e instanceof IOException) {
                    // IOException which occur in notifyRead must be distinguished from
                    // IOException which occur in handshake or readNonBlock.
                    this.onError(ch, e)
                    return NextSocketAction.CLOSE
                }
                else {
                    throw e
                }
            }
        }
    }


    onWrite(ch: ChannelWrapper, listener: DataConsumeListener): number {
        this.checkChannel(ch);
        BayLog.trace("%s onWrite", this);
        if(listener != null)
            listener()
        if(this.finale) {
            BayLog.trace("%s finale and close", this)
            return NextSocketAction.CLOSE
        }
        else if (this.writeOnly) {
            return NextSocketAction.SUSPEND
        }
        else {
            return NextSocketAction.CONTINUE
        }
    }

    checkTimeout(chkCh: ChannelWrapper, durationSec: number): boolean {
        this.checkChannel(chkCh);

        return this.dataListener.checkTimeout(durationSec);
    }

    onError(chkCh: ChannelWrapper, e: Error): void {
        this.checkChannel(chkCh);
        //BayLog.error_e(e, "%s Error", this)
        this.dataListener.notifyError(e)
        this.chValid = false
    }


    onClosed(chkCh: ChannelWrapper): void {
        try {
            this.checkChannel(chkCh)
        }
        catch(e) {
            BayLog.error_e(e);
            return;
        }

        if(!this.chValid)
            return

        this.setValid(false);

        this.dataListener.notifyClose()
    }

    getBuf(): Buffer {
        return this.readBuf
    }

    //////////////////////////////////////////////////////
    // other methods
    //////////////////////////////////////////////////////

    public abort() {
        BayLog.debug("%s abort", this);
        this.nonBlockingHandler.askToClose(this.channel)
    }

    isZombie(): boolean {
        return this.channel != null && !this.chValid;
    }

    flush(): void {
        this.checkInitialized();
        BayLog.debug("%s flush", this);
    }

    postEnd(): void {
        this.checkInitialized();

        BayLog.debug("%s postEnd vld=%s", this, this.chValid);
        this.finale = true;
    }

    private checkChannel(chkCh: ChannelWrapper): void {
        this.checkInitialized()
        if(chkCh !== this.channel)
            throw new Sink("%s Invalid transporter instance (ship was returned?)", this);
    }

    private checkInitialized(): void {
        if(!this.initialized)
            throw new Sink("%s Transporter not initialized", this);
    }

    private setValid(valid: boolean): void {
        this.chValid = valid;
    }


}