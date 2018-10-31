"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const EE = require("events");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
class NodeV8Message {
    constructor(type) {
        this.seq = 0;
        this.type = type;
    }
}
exports.NodeV8Message = NodeV8Message;
class NodeV8Response extends NodeV8Message {
    constructor(request, message) {
        super('response');
        this.request_seq = request.seq;
        this.command = request.command;
        if (message) {
            this.success = false;
            this.message = message;
        }
        else {
            this.success = true;
        }
    }
}
exports.NodeV8Response = NodeV8Response;
class NodeV8Event extends NodeV8Message {
    constructor(event, body) {
        super('event');
        this.event = event;
        if (body) {
            this.body = body;
        }
    }
}
exports.NodeV8Event = NodeV8Event;
//---- the protocol implementation
class NodeV8Protocol extends EE.EventEmitter {
    constructor(responseHook) {
        super();
        this._pendingRequests = new Map();
        this.embeddedHostVersion = -1;
        this._responseHook = responseHook;
    }
    startDispatch(inStream, outStream) {
        this._sequence = 1;
        this._writableStream = outStream;
        inStream.on('data', (data) => this.execute(data));
        inStream.on('close', () => {
            this.emitEvent(new NodeV8Event('close'));
        });
        inStream.on('error', (error) => {
            this.emitEvent(new NodeV8Event('error'));
        });
        outStream.on('error', (error) => {
            this.emitEvent(new NodeV8Event('error'));
        });
        inStream.resume();
    }
    stop() {
        if (this._writableStream) {
            this._writableStream.end();
        }
    }
    command(command, args, cb) {
        this._command(command, args, NodeV8Protocol.TIMEOUT, cb);
    }
    command2(command, args, timeout = NodeV8Protocol.TIMEOUT) {
        return new Promise((resolve, reject) => {
            this._command(command, args, timeout, response => {
                if (response.success) {
                    resolve(response);
                }
                else {
                    if (!response.command) {
                        // some responses don't have the 'command' attribute.
                        response.command = command;
                    }
                    reject(response);
                }
            });
        });
    }
    backtrace(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('backtrace', args);
    }
    restartFrame(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('restartframe', args);
    }
    evaluate(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('evaluate', args);
    }
    scripts(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('scripts', args);
    }
    setVariableValue(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('setvariablevalue', args);
    }
    frame(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('frame', args);
    }
    setBreakpoint(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('setbreakpoint', args);
    }
    setExceptionBreak(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('setexceptionbreak', args);
    }
    clearBreakpoint(args, timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('clearbreakpoint', args);
    }
    listBreakpoints(timeout = NodeV8Protocol.TIMEOUT) {
        return this.command2('listbreakpoints');
    }
    sendEvent(event) {
        this.send('event', event);
    }
    sendResponse(response) {
        if (response.seq > 0) {
            // console.error('attempt to send more than one response for command {0}', response.command);
        }
        else {
            this.send('response', response);
        }
    }
    // ---- private ------------------------------------------------------------
    _command(command, args, timeout, cb) {
        const request = {
            command: command
        };
        if (args && Object.keys(args).length > 0) {
            request.arguments = args;
        }
        if (!this._writableStream) {
            if (cb) {
                cb(new NodeV8Response(request, localize(0, null)));
            }
            return;
        }
        if (this._unresponsiveMode) {
            if (cb) {
                cb(new NodeV8Response(request, localize(1, null)));
            }
            return;
        }
        this.send('request', request);
        if (cb) {
            this._pendingRequests.set(request.seq, cb);
            const timer = setTimeout(() => {
                clearTimeout(timer);
                const clb = this._pendingRequests.get(request.seq);
                if (clb) {
                    this._pendingRequests.delete(request.seq);
                    clb(new NodeV8Response(request, localize(2, null, timeout)));
                    this._unresponsiveMode = true;
                    this.emitEvent(new NodeV8Event('diagnostic', { reason: `request '${command}' timed out'` }));
                }
            }, timeout);
        }
    }
    emitEvent(event) {
        this.emit(event.event, event);
    }
    send(typ, message) {
        message.type = typ;
        message.seq = this._sequence++;
        const json = JSON.stringify(message);
        const data = 'Content-Length: ' + Buffer.byteLength(json, 'utf8') + '\r\n\r\n' + json;
        if (this._writableStream) {
            this._writableStream.write(data);
        }
    }
    internalDispatch(message) {
        switch (message.type) {
            case 'event':
                const e = message;
                this.emitEvent(e);
                break;
            case 'response':
                if (this._unresponsiveMode) {
                    this._unresponsiveMode = false;
                    this.emitEvent(new NodeV8Event('diagnostic', { reason: 'responsive' }));
                }
                const response = message;
                const clb = this._pendingRequests.get(response.request_seq);
                if (clb) {
                    this._pendingRequests.delete(response.request_seq);
                    if (this._responseHook) {
                        this._responseHook(response);
                    }
                    clb(response);
                }
                break;
            default:
                break;
        }
    }
    execute(data) {
        this._rawData = this._rawData ? Buffer.concat([this._rawData, data]) : data;
        while (true) {
            if (this._contentLength >= 0) {
                if (this._rawData.length >= this._contentLength) {
                    const message = this._rawData.toString('utf8', 0, this._contentLength);
                    this._rawData = this._rawData.slice(this._contentLength);
                    this._contentLength = -1;
                    if (message.length > 0) {
                        try {
                            this.internalDispatch(JSON.parse(message));
                        }
                        catch (e) {
                        }
                    }
                    continue; // there may be more complete messages to process
                }
            }
            else {
                const idx = this._rawData.indexOf(NodeV8Protocol.TWO_CRLF);
                if (idx !== -1) {
                    const header = this._rawData.toString('utf8', 0, idx);
                    const lines = header.split('\r\n');
                    for (let i = 0; i < lines.length; i++) {
                        const pair = lines[i].split(/: +/);
                        switch (pair[0]) {
                            case 'V8-Version':
                                const match0 = pair[1].match(/(\d+(?:\.\d+)+)/);
                                if (match0 && match0.length === 2) {
                                    this.v8Version = match0[1];
                                }
                                break;
                            case 'Embedding-Host':
                                const match = pair[1].match(/node\sv(\d+)\.(\d+)\.(\d+)/);
                                if (match && match.length === 4) {
                                    this.embeddedHostVersion = (parseInt(match[1]) * 100 + parseInt(match[2])) * 100 + parseInt(match[3]);
                                }
                                else if (pair[1] === 'Electron') {
                                    this.embeddedHostVersion = 60500; // TODO this needs to be detected in a smarter way by looking at the V8 version in Electron
                                }
                                const match1 = pair[1].match(/node\s(v\d+\.\d+\.\d+)/);
                                if (match1 && match1.length === 2) {
                                    this.hostVersion = match1[1];
                                }
                                break;
                            case 'Content-Length':
                                this._contentLength = +pair[1];
                                break;
                        }
                    }
                    this._rawData = this._rawData.slice(idx + NodeV8Protocol.TWO_CRLF.length);
                    continue; // try to handle a complete message
                }
            }
            break;
        }
    }
}
NodeV8Protocol.TIMEOUT = 10000;
NodeV8Protocol.TWO_CRLF = '\r\n\r\n';
exports.NodeV8Protocol = NodeV8Protocol;

//# sourceMappingURL=../../out/node/nodeV8Protocol.js.map
