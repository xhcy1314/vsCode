"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const isWindows = process.platform === 'win32';
const is64bit = process.arch === 'x64';
function subsystemLinuxPresent() {
    if (!isWindows) {
        return false;
    }
    const bashPath32bitApp = path.join(process.env['SystemRoot'], 'Sysnative', 'bash.exe');
    const bashPath64bitApp = path.join(process.env['SystemRoot'], 'System32', 'bash.exe');
    const bashPathHost = is64bit ? bashPath64bitApp : bashPath32bitApp;
    return fs.existsSync(bashPathHost);
}
exports.subsystemLinuxPresent = subsystemLinuxPresent;
function windowsPathToWSLPath(windowsPath) {
    if (!isWindows || !windowsPath) {
        return undefined;
    }
    if (path.isAbsolute(windowsPath)) {
        return `/mnt/${windowsPath.substr(0, 1).toLowerCase()}/${windowsPath.substr(3).replace(/\\/g, '/')}`;
    }
    return windowsPath.replace(/\\/g, '/');
}
function createLaunchArg(useSubsytemLinux, useExternalConsole, cwd, executable, args, program) {
    if (useSubsytemLinux && subsystemLinuxPresent()) {
        const bashPath32bitApp = path.join(process.env['SystemRoot'], 'Sysnative', 'bash.exe');
        const bashPath64bitApp = path.join(process.env['SystemRoot'], 'System32', 'bash.exe');
        const bashPathHost = is64bit ? bashPath64bitApp : bashPath32bitApp;
        const subsystemLinuxPath = useExternalConsole ? bashPath64bitApp : bashPathHost;
        let bashCommand = [executable].concat(args || []).map(element => {
            if (element === program) {
                element = element.replace(/\\/g, '/');
            }
            return element.indexOf(' ') > 0 ? `'${element}'` : element;
        }).join(' ');
        return {
            cwd: cwd,
            executable: subsystemLinuxPath,
            args: ['-c', bashCommand],
            combined: [subsystemLinuxPath].concat(['-c', bashCommand]),
            localRoot: cwd,
            remoteRoot: windowsPathToWSLPath(cwd)
        };
    }
    else {
        return {
            cwd: cwd,
            executable: executable,
            args: args || [],
            combined: [executable].concat(args || [])
        };
    }
}
exports.createLaunchArg = createLaunchArg;
function spawnSync(useWSL, executable, args, options) {
    const launchArgs = createLaunchArg(useWSL, false, undefined, executable, args);
    return child_process.spawnSync(launchArgs.executable, launchArgs.args, useWSL ? undefined : options);
}
exports.spawnSync = spawnSync;

//# sourceMappingURL=../../out/node/wslSupport.js.map
