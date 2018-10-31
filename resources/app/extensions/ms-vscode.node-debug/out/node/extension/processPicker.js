/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
const vscode = require("vscode");
const path_1 = require("path");
const processTree_1 = require("./processTree");
const child_process_1 = require("child_process");
const protocolDetection_1 = require("./protocolDetection");
const localize = nls.loadMessageBundle(__filename);
/**
 * end user action for picking a process and attaching debugger to it
 */
function attachProcess() {
    return __awaiter(this, void 0, void 0, function* () {
        const config = {
            type: 'node',
            request: 'attach',
            name: 'process',
            processId: '${command:extension.pickNodeProcess}'
        };
        if (!(yield resolveProcessId(config))) {
            return vscode.debug.startDebugging(undefined, config);
        }
        return undefined;
    });
}
exports.attachProcess = attachProcess;
/**
 * returns true if UI was cancelled
 */
function resolveProcessId(config) {
    return __awaiter(this, void 0, void 0, function* () {
        // we resolve Process Picker early (before VS Code) so that we can probe the process for its protocol
        let processId = config.processId.trim();
        if (processId === '${command:PickProcess}' || processId === '${command:extension.pickNodeProcess}') {
            const result = yield pickProcess(true); // ask for pids and ports!
            if (!result) {
                // UI dismissed (cancelled)
                return true;
            }
            processId = result;
        }
        const matches = /^(inspector|legacy)?([0-9]+)(inspector|legacy)?([0-9]+)?$/.exec(processId);
        if (matches && matches.length === 5) {
            if (matches[2] && matches[3] && matches[4]) {
                // process id and protocol and port
                const pid = Number(matches[2]);
                putPidInDebugMode(pid);
                // debug port
                config.port = Number(matches[4]);
                config.protocol = matches[3];
                delete config.processId;
            }
            else {
                // protocol and port
                if (matches[1]) {
                    // debug port
                    config.port = Number(matches[2]);
                    config.protocol = matches[1];
                    delete config.processId;
                }
                else {
                    // process id
                    const pid = Number(matches[2]);
                    putPidInDebugMode(pid);
                    const debugType = yield determineDebugTypeForPidInDebugMode(config, pid);
                    if (debugType) {
                        // processID is handled, so turn this config into a normal port attach configuration
                        delete config.processId;
                        config.port = debugType === 'node2' ? protocolDetection_1.INSPECTOR_PORT_DEFAULT : protocolDetection_1.LEGACY_PORT_DEFAULT;
                        config.protocol = debugType === 'node2' ? 'inspector' : 'legacy';
                    }
                    else {
                        throw new Error(localize(0, null, processId));
                    }
                }
            }
        }
        else {
            throw new Error(localize(1, null, processId));
        }
        return false;
    });
}
exports.resolveProcessId = resolveProcessId;
/**
 * Process picker command (for launch config variable)
 * Returns as a string with these formats:
 * - "12345": process id
 * - "inspector12345": port number and inspector protocol
 * - "legacy12345": port number and legacy protocol
 * - null: abort launch silently
 */
function pickProcess(ports) {
    return listProcesses(ports).then(items => {
        let options = {
            placeHolder: localize(2, null),
            matchOnDescription: true,
            matchOnDetail: true
        };
        return vscode.window.showQuickPick(items, options).then(item => item ? item.pidOrPort : null);
    }).catch(err => {
        return vscode.window.showErrorMessage(localize(3, null, err.message), { modal: true }).then(_ => null);
    });
}
exports.pickProcess = pickProcess;
//---- private
function listProcesses(ports) {
    const items = [];
    const DEBUG_FLAGS_PATTERN = /--(inspect|debug)(-brk)?(=(\d+))?[^-]/;
    const DEBUG_PORT_PATTERN = /--(inspect|debug)-port=(\d+)/;
    const NODE = new RegExp('^(?:node|iojs)$', 'i');
    let seq = 0; // default sort key
    return processTree_1.getProcesses((pid, ppid, command, args, date) => {
        if (process.platform === 'win32' && command.indexOf('\\??\\') === 0) {
            // remove leading device specifier
            command = command.replace('\\??\\', '');
        }
        const executable_name = path_1.basename(command, '.exe');
        let port = -1;
        let protocol = '';
        let usePid = true;
        if (ports) {
            // match --debug, --debug=1234, --debug-brk, debug-brk=1234, --inspect, --inspect=1234, --inspect-brk, --inspect-brk=1234
            let matches = DEBUG_FLAGS_PATTERN.exec(args);
            if (matches && matches.length >= 2) {
                // attach via port
                if (matches.length === 5 && matches[4]) {
                    port = parseInt(matches[4]);
                }
                protocol = matches[1] === 'debug' ? 'legacy' : 'inspector';
                usePid = false;
            }
            // a debug-port=1234 or --inspect-port=1234 overrides the port
            matches = DEBUG_PORT_PATTERN.exec(args);
            if (matches && matches.length === 3) {
                // override port
                port = parseInt(matches[2]);
                protocol = matches[1] === 'debug' ? 'legacy' : 'inspector';
            }
        }
        let description = '';
        let pidOrPort = '';
        if (usePid) {
            if (protocol && port > 0) {
                description = localize(4, null, pid, port, 'SIGUSR1');
                pidOrPort = `${pid}${protocol}${port}`;
            }
            else {
                // no port given
                if (NODE.test(executable_name)) {
                    description = localize(5, null, pid, 'SIGUSR1');
                    pidOrPort = pid.toString();
                }
            }
        }
        else {
            if (port < 0) {
                port = protocol === 'inspector' ? protocolDetection_1.INSPECTOR_PORT_DEFAULT : protocolDetection_1.LEGACY_PORT_DEFAULT;
            }
            if (protocol === 'inspector') {
                description = localize(6, null, pid, port);
            }
            else {
                description = localize(7, null, pid, port);
            }
            pidOrPort = `${protocol}${port}`;
        }
        if (description && pidOrPort) {
            items.push({
                // render data
                label: executable_name,
                description: args,
                detail: description,
                // picker result
                pidOrPort: pidOrPort,
                // sort key
                sortKey: date ? date : seq++
            });
        }
    }).then(() => items.sort((a, b) => b.sortKey - a.sortKey)); // sort items by process id, newest first
}
function putPidInDebugMode(pid) {
    try {
        if (process.platform === 'win32') {
            // regular node has an undocumented API function for forcing another node process into debug mode.
            // 		(<any>process)._debugProcess(pid);
            // But since we are running on Electron's node, process._debugProcess doesn't work (for unknown reasons).
            // So we use a regular node instead:
            const command = `node -e process._debugProcess(${pid})`;
            child_process_1.execSync(command);
        }
        else {
            process.kill(pid, 'SIGUSR1');
        }
    }
    catch (e) {
        throw new Error(localize(8, null, pid, e));
    }
}
function determineDebugTypeForPidInDebugMode(config, pid) {
    let debugProtocolP;
    if (config.port === protocolDetection_1.INSPECTOR_PORT_DEFAULT) {
        debugProtocolP = Promise.resolve('inspector');
    }
    else if (config.port === protocolDetection_1.LEGACY_PORT_DEFAULT) {
        debugProtocolP = Promise.resolve('legacy');
    }
    else if (config.protocol) {
        debugProtocolP = Promise.resolve(config.protocol);
    }
    else {
        debugProtocolP = protocolDetection_1.detectProtocolForPid(pid);
    }
    return debugProtocolP.then(debugProtocol => {
        return debugProtocol === 'inspector' ? 'node2' :
            debugProtocol === 'legacy' ? 'node' :
                null;
    });
}

//# sourceMappingURL=../../../out/node/extension/processPicker.js.map
