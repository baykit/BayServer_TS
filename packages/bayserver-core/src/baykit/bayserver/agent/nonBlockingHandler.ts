import {GrandAgent} from "./grandAgent";
import {BayLog} from "../bayLog";
import {DataConsumeListener} from "../util/dataConsumeListener";
import {NextSocketAction} from "./nextSocketAction";
import {Buffer} from "buffer";
import {ChannelListener} from "./channelListener";
import {IOException} from "../util/ioException";
import {Sink} from "../sink";
import {ArrayUtil} from "../util/arrayUtil";
import {ChannelWrapper} from "./channelWrapper";
import {TimerHandler} from "./timerHandler";
import * as tls from "tls";
import * as fs from "fs";

class ChannelState {
    readonly ch: ChannelWrapper
    readonly listener: ChannelListener

    accepted: boolean
    lastAccessTime: number
    closing: boolean

    constructor(ch: ChannelWrapper, listener: ChannelListener) {
        this.ch = ch;
        this.listener = listener;
        this.accepted = false;
        this.closing = false
    }

    access() {
        this.lastAccessTime = Date.now()
    }

    toString(): string {
        let s = ""
        if(this.listener)
            s = this.listener.toString()

        if(this.closing)
            s += " closing=true"

        return s
    }
}

export class NonBlockingHandler implements TimerHandler {

    readonly agent: GrandAgent
    chStates: ChannelState[] = []
    chCount: number = 0

    constructor(agent: GrandAgent) {
        this.agent = agent
        this.agent.addTimerHandler(this)
    }


    //////////////////////////////////////////////////////
    // Implements TimerHandler
    //////////////////////////////////////////////////////
    onTimer(): void {
        this.closeTimeoutSockets()
    }

    //////////////////////////////////////////////////////
    // Custom methods
    //////////////////////////////////////////////////////

    addChannelListener(ch: ChannelWrapper, chLis: ChannelListener) : ChannelState {
        let chState = new ChannelState(ch, chLis)
        this.addChannelState(ch, chState)
        if(ch.type == ChannelWrapper.TYPE_SOCKET || ch.type == ChannelWrapper.TYPE_READABLE) {
            this.setupSocketEvents(ch, chState)
        }
        chState.access()
        return chState
    }

    askToStart(ch: ChannelWrapper) {
        let chState = this.findChannelState(ch)
        BayLog.debug("%s askToStart ch=%s", this.agent, chState);
        chState.accepted = true
    }


    askToConnect(ch: ChannelWrapper, addr: string, port: number) {
        if(ch == null)
            throw new Error("nullPo");

        BayLog.debug("%s askToConnect addr=%s port=%d", this.agent, addr, port);
        let chState = this.findChannelState(ch)

        let callback = () => {
            try {
                this.onConnect(chState)
            }
            catch(e) {
                this.agent.abort(e)
            }
        }

        if(port == 0) {
            // UNIX domain socket
            ch.socket.connect(addr, callback)
        }
        else {
            ch.socket.connect(port, addr, callback)
        }

        //this.setupSocketEvents(ch, chState)
    }

    askToRead(ch: ChannelWrapper) {
        BayLog.debug("%s askToRead", this.agent);

        let chState = this.findChannelState(ch)
        if(chState == null) {
            BayLog.warn("%s channel state not found: %s", this.agent, ch)
            return
        }

        if(ch.type == ChannelWrapper.TYPE_SOCKET) {
            if (ch.socket.isPaused())
                ch.socket.resume() // read on
        }
        else if(ch.type == ChannelWrapper.TYPE_READABLE) {
            if (ch.readable.isPaused())
                ch.readable.resume() // read on
        }
        else {
            this.readFs(chState)
        }

        chState.access()
    }

    askToWrite(buf: Buffer, ch: ChannelWrapper, listener: DataConsumeListener) : void {
        BayLog.debug("%s askToWrite: len=%d", this.agent, buf.length);

        let chState = this.findChannelState(ch)
        if(chState == null) {
            BayLog.warn("%s channel state not found: %s", this.agent, ch)
            return
        }

        if(ch.type == ChannelWrapper.TYPE_SOCKET) {
            ch.socket.write(buf, (err) => {
                if (err) {
                    BayLog.debug("%s Write error on writing %d bytes", this.agent, buf.length)
                    // This error will be handled by error event such as ch.on("error", ...)
                    //    this.onError(chState, err)
                }
                else {
                    BayLog.debug("%s Wrote: len=%d", this.agent, buf.length);
                }

                if(this.agent.aborted)
                    return

                let chState = this.findChannelState(ch)
                if(chState == null || chState.closing) {
                    // channel is already closed
                    BayLog.debug("Channel is closed: buflen=%d", buf.length)
                    return
                }

                try {
                    this.onWrite(chState, listener)
                }
                catch(e) {
                    this.agent.abort(e)
                }
            })
        }
        else if(ch.type == ChannelWrapper.TYPE_READABLE) {
            throw new Sink()
        }
        else {
            fs.write(ch.fd, buf, 0, buf.length, (err, written) => {
                let chState = this.findChannelState(ch)
                try {
                    if(err) {
                        this.onError(chState, err)
                    }
                    else {
                        this.onWrite(chState, listener)
                    }
                }
                catch(e) {
                    this.agent.abort(e)
                }
            })
        }
        chState.access()
    }

    askToClose(ch: ChannelWrapper) {
        let chState = this.findChannelState(ch)
        BayLog.debug("%s askToClose chState=%s", this.agent, chState);

        if(chState == null) {
            BayLog.warn("%s channel state not found: %s", this.agent, ch)
            return
        }

        this.closeChannel(chState)
        chState.access()
    }


    closeTimeoutSockets() {
        if(this.chStates.length == 0)
            return

        let closeList = []
        let now =  Date.now()
        for(const chState of this.chStates) {
            if(chState.listener != null) {
                try {
                    let durationSec = Math.floor((now - chState.lastAccessTime) / 1000)
                    if (chState.listener.checkTimeout(chState.ch, durationSec)) {
                        BayLog.debug("%s timed out channel found: ch=%s", this.agent, chState.ch)
                        closeList.push(chState)
                    }
                }
                catch(e) {
                    if(!(e instanceof IOException))
                        throw e
                    else {
                        BayLog.error_e(e)
                        closeList.push(chState)
                    }

                }
            }
        }

        for(const chState of closeList) {
            this.closeChannel(chState)
        }
    }

    closeAll(): void {
        for(const chState of this.chStates) {
            this.closeChannel(chState)
        }
    }

    //////////////////////////////////////////////////////
    // Private methods
    //////////////////////////////////////////////////////
    private addChannelState(ch: ChannelWrapper, chState: ChannelState): void {
        //BayLog.debug("%s add ch %s chState=%s", this.agent, ch, chState);

        for(let st of this.chStates) {
            if(st.ch === ch) {
                BayLog.debug("%s already added", this.agent);
                return;
            }
        }
        this.chStates.push(chState)
        this.chCount++
    }

    private removeChannelState(ch: ChannelWrapper) {
        //BayLog.debug("%s remove ch %s", this.agent, ch);

        for(let i = 0; i < this.chStates.length; i++) {
            if(this.chStates[i].ch === ch) {
                ArrayUtil.removeAt(i, this.chStates)
                break
            }
        }
        this.chCount--
    }

    private findChannelState(ch: ChannelWrapper): ChannelState {
        //BayLog.debug("%s find chState %s", this.agent, ch);
        for(const chState of this.chStates) {
            //BayLog.debug("%s EQ Check ch %s", this.agent, chState.ch);
            if(chState.ch === ch) {
                //BayLog.debug("%s find ch %s chState=%s", this.agent, ch, chState);
                return chState
            }
        }
        return null
    }

    private setupSocketEvents(ch: ChannelWrapper, chState: ChannelState) {

        ch.socket.on("error", (err) => {
            if(this.agent.aborted)
                return
            let chState = this.findChannelState(ch)
            if(chState == null || chState.closing) {
                // channel is already closed
                BayLog.debug_e(err, "%s Error occured after channel is closed", this.agent)
                return
            }
            try {
                this.onError(chState, err)
            }
            catch(e) {
                this.agent.abort(e)
	        }
        })

        ch.socket.on('data', (buf: Buffer) => {
            if(this.agent.aborted)
                return
            let chState = this.findChannelState(ch)
            if(chState == null || chState.closing) {
                // channel is already closed
                BayLog.debug("%s Channel is already closed: buflen=%d", this.agent, buf.length)
                return
            }
            try {
                this.onRead(buf, chState)
            }
            catch(e) {
                this.agent.abort(e)
            }
        })
        ch.socket.pause() // read off

        if(ch.socket instanceof tls.TLSSocket)
            ch.socket.on("secureConnect", () => {
                BayLog.debug("%s Secure connect", this.agent)
            })

        ch.socket.on('end', () => {
            if(this.agent.aborted)
                return
            let chState = this.findChannelState(ch)
            if(chState == null || chState.closing) {
                // channel is already closed
                return
            }
            BayLog.debug("%s channel end event: %s", this.agent, chState)
            try {
                this.onEof(chState)
            }
            catch(e) {
                this.agent.abort(e)
            }
            chState.closing = true
        })
    }

    private onConnect(chState: ChannelState) {
        var nextAct
        try {
            nextAct = chState.listener.onConnect(chState.ch)
        }
        catch(e) {
            if(e instanceof IOException) {
                BayLog.error_e(e)
                nextAct = NextSocketAction.CLOSE
            }
            else
                throw e
        }

        if(nextAct == NextSocketAction.CONTINUE)
            this.askToRead(chState.ch)
        this.doNextAction(nextAct, chState, false)
    }

    private onRead(buf: Buffer, chState: ChannelState) {
        var nextAct
        try {
            //BayLog.info("Read buf: len=%d blen=%d cont=%s", buf.length, buf.byteLength, buf)
            nextAct = chState.listener.onRead(chState.ch, buf)
        }
        catch(e) {
            if(e instanceof IOException) {
                BayLog.error_e(e, "Error in listener.onRead()")
                nextAct = NextSocketAction.CLOSE
            }
            else
                throw e
        }

        this.doNextAction(nextAct, chState, true)
    }

    private onWrite(chState: ChannelState, dataLis: DataConsumeListener) {
        let nextAct
        try {
            nextAct = chState.listener.onWrite(chState.ch, dataLis)
        }
        catch(e) {
            if(e instanceof IOException) {
                BayLog.error_e(e)
                nextAct = NextSocketAction.CLOSE
            }
            else
                throw e
        }

        this.doNextAction(nextAct, chState, false)
    }

    private onEof(chState: ChannelState) {
        let nextAct
        try {
            nextAct = chState.listener.onRead(chState.ch, Buffer.alloc(0))
        }
        catch(e) {
            if(e instanceof IOException) {
                BayLog.error_e(e)
            }
            else
                throw e
        }

        this.doNextAction(nextAct, chState, false)
    }

    private onError(chState: ChannelState, err: Error) {
        chState.listener.onError(chState.ch, err)

        this.doNextAction(NextSocketAction.CLOSE, chState, false)
    }

    private onClosed(chState: ChannelState) {
        chState.listener.onClosed(chState.ch);
    }

    private doNextAction(act: number, chState: ChannelState, isReading: boolean) {
        switch (act) {
            case NextSocketAction.CONTINUE:
                if (!isReading)
                    break

            case NextSocketAction.READ:
                if(!(chState.ch.type == ChannelWrapper.TYPE_SOCKET || chState.ch.type == ChannelWrapper.TYPE_READABLE)) {
                    this.readFs(chState)
                }
                break

            case NextSocketAction.WRITE:
                break

            case NextSocketAction.CLOSE:
                this.closeChannel(chState)
                break

            case NextSocketAction.SUSPEND:
                if(chState.ch.type == ChannelWrapper.TYPE_SOCKET) {
                    BayLog.debug("%s Suspend socket reading", this.agent)
                    chState.ch.socket.pause()
                }
                else if(chState.ch.type == ChannelWrapper.TYPE_READABLE) {
                    BayLog.debug("%s Suspend readable reading", this.agent)
                    chState.ch.readable.pause()
                }
                break
        }
        chState.access()
    }

    private readFs(chState: ChannelState) {
        let buf = chState.listener.getBuf()
        fs.read(chState.ch.fd, buf, 0, buf.length, -1, (err, bytesRead, buffer) => {
            if(err) {
                this.onError(chState, err)
            }
            else {
                try {
                    //if(bytesRead == 0)
                    //    return // no data read
                    if(bytesRead < buf.length) {
                        let newBuf = Buffer.alloc(bytesRead)
                        buf.copy(newBuf, 0, 0, bytesRead)
                        buf = newBuf
                    }
                    this.onRead(buf, chState)
                }
                catch(e) {
                    this.agent.abort(e)
                }
            }
        })
    }

    private closeChannel(chState: ChannelState) {

        BayLog.debug("%s Close channel: %s", this.agent, chState)
        if(chState.ch.type == ChannelWrapper.TYPE_SOCKET){
            chState.ch.socket.pause()

            // catches close event
            chState.ch.socket.on('close', (err) => {
                if (err) {
                    BayLog.debug("%s Socket closed by error", this.agent)
                } else {
                    BayLog.debug("%s Socket closed", this.agent)
                }
                try {
                    this.onClosed(chState)
                } catch (e) {
                    this.agent.abort(e)
                }
                this.removeChannelState(chState.ch)
            });

            // 'close' event will occur
            chState.ch.socket.destroy()
        }
        else if( chState.ch.type == ChannelWrapper.TYPE_READABLE) {
            chState.ch.readable.destroy() // 'close' event will occur
        }
        else {
            fs.close(chState.ch.fd, (err): void => {
                try {
                    if (err)
                        BayLog.error_e(err)

                    if(chState.listener != null)
                        this.onClosed(chState);
                    this.removeChannelState(chState.ch)
                }
                catch(e) {
                    this.agent.abort(e)
                }
            })
        }
    }
}
