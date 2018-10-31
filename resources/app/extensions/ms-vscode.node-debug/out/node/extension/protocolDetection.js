/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
const cp = require("child_process");
const utilities_1 = require("./utilities");
const net = require("net");
const WSL = require("../wslSupport");
const localize = nls.loadMessageBundle(__filename);
exports.INSPECTOR_PORT_DEFAULT = 9229;
exports.LEGACY_PORT_DEFAULT = 5858;
// For launch, use inspector protocol starting with v8 because it's stable after that version.
const InspectorMinNodeVersionLaunch = 80000;
function detectDebugType(config, logger) {
    switch (config.request) {
        case 'attach':
            return detectProtocolForAttach(config, logger).then(protocol => {
                return protocol === 'inspector' ? 'node2' : 'node';
            });
        case 'launch':
            return Promise.resolve(detectProtocolForLaunch(config, logger) === 'inspector' ? 'node2' : 'node');
        default:
            // should not happen
            break;
    }
    return Promise.resolve(null);
}
exports.detectDebugType = detectDebugType;
/**
 * Detect which debug protocol is being used for a running node process.
 */
function detectProtocolForAttach(config, logger) {
    const address = config.address || '127.0.0.1';
    const port = config.port;
    const socket = new net.Socket();
    const cleanup = () => {
        try {
            socket.write(`"Content-Length: 50\r\n\r\n{"command":"disconnect","type":"request","seq":2}"`);
            socket.end();
        }
        catch (e) {
            // ignore failure
        }
    };
    return new Promise((resolve, reject) => {
        socket.once('data', data => {
            let reason = undefined;
            let protocol;
            const dataStr = data.toString();
            if (dataStr.indexOf('WebSockets request was expected') >= 0) {
                logger.debug('Debugging with inspector protocol because it was detected.');
                protocol = 'inspector';
            }
            else {
                reason = localize(0, null);
                protocol = 'legacy';
            }
            resolve({ reason, protocol });
        });
        socket.once('error', err => {
            reject(err);
        });
        socket.connect(port, address);
        socket.on('connect', () => {
            // Send a safe request to trigger a response from the inspector protocol
            socket.write(`Content-Length: 102\r\n\r\n{"command":"evaluate","arguments":{"expression":"process.pid","global":true},"type":"request","seq":1}`);
        });
        setTimeout(() => {
            // No data or error received? Bail and let the debug adapter handle it.
            reject(new Error('timeout'));
        }, 2000);
    }).catch(err => {
        return {
            reason: localize(1, null, err.toString()),
            protocol: 'inspector'
        };
    }).then(result => {
        cleanup();
        if (result.reason) {
            utilities_1.writeToConsole(result.reason);
            logger.debug(result.reason);
        }
        return result.protocol;
    });
}
function detectProtocolForLaunch(config, logger) {
    if (config.runtimeExecutable) {
        logger.debug('Debugging with inspector protocol because a runtime executable is set.');
        return 'inspector';
    }
    else {
        // only determine version if no runtimeExecutable is set (and 'node' on PATH is used)
        let env = process.env;
        if (config.env) {
            env = utilities_1.extendObject(utilities_1.extendObject({}, process.env), config.env);
        }
        const result = WSL.spawnSync(config.useWSL, 'node', ['--version'], { shell: true, env: env });
        const semVerString = result.stdout ? result.stdout.toString() : undefined;
        if (semVerString) {
            config.__nodeVersion = semVerString.trim();
            if (semVerStringToInt(config.__nodeVersion) >= InspectorMinNodeVersionLaunch) {
                logger.debug(`Debugging with inspector protocol because Node.js ${config.__nodeVersion} was detected.`);
                return 'inspector';
            }
            else {
                utilities_1.writeToConsole(localize(2, null, config.__nodeVersion));
                logger.debug(`Debugging with legacy protocol because Node.js ${config.__nodeVersion} was detected.`);
                return 'legacy';
            }
        }
        else {
            logger.debug('Debugging with inspector protocol because Node.js version could not be determined.');
            return 'inspector';
        }
    }
}
/**
 * convert the 3 parts of a semVer string into a single number
 */
function semVerStringToInt(vString) {
    const match = vString.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (match && match.length === 4) {
        return (parseInt(match[1]) * 100 + parseInt(match[2])) * 100 + parseInt(match[3]);
    }
    return -1;
}
function detectProtocolForPid(pid) {
    return process.platform === 'win32' ?
        detectProtocolForPidWin(pid) :
        detectProtocolForPidUnix(pid);
}
exports.detectProtocolForPid = detectProtocolForPid;
function detectProtocolForPidWin(pid) {
    return getOpenPortsForPidWin(pid).then(ports => {
        return ports.indexOf(exports.INSPECTOR_PORT_DEFAULT) >= 0 ? 'inspector' :
            ports.indexOf(exports.LEGACY_PORT_DEFAULT) >= 0 ? 'legacy' : null;
    });
}
/**
 * Netstat output is like:
   Proto  Local Address          Foreign Address        State           PID
   TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       812
 */
function getOpenPortsForPidWin(pid) {
    return new Promise(resolve => {
        cp.exec('netstat -a -n -o -p TCP', (err, stdout) => {
            if (err || !stdout) {
                resolve([]);
            }
            const ports = stdout
                .split(/\r?\n/)
                .map(line => line.trim().split(/\s+/))
                .filter(lineParts => {
                // Filter to just `pid` rows
                return lineParts[4] && lineParts[4] === String(pid);
            })
                .map(lineParts => {
                const address = lineParts[1];
                return parseInt(address.split(':')[1]);
            });
            resolve(ports);
        });
    });
}
function detectProtocolForPidUnix(pid) {
    return getPidListeningOnPortUnix(exports.INSPECTOR_PORT_DEFAULT).then(inspectorProtocolPid => {
        if (inspectorProtocolPid === pid) {
            return 'inspector';
        }
        else {
            return getPidListeningOnPortUnix(exports.LEGACY_PORT_DEFAULT)
                .then(legacyProtocolPid => legacyProtocolPid === pid ? 'legacy' : null);
        }
    });
}
function getPidListeningOnPortUnix(port) {
    return new Promise(resolve => {
        cp.exec(`lsof -i:${port} -F p`, (err, stdout) => {
            if (err || !stdout) {
                resolve(-1);
                return;
            }
            const pidMatch = stdout.match(/p(\d+)/);
            if (pidMatch && pidMatch[1]) {
                resolve(Number(pidMatch[1]));
            }
            else {
                resolve(-1);
            }
        });
    });
}

//# sourceMappingURL=../../../out/node/extension/protocolDetection.js.map
