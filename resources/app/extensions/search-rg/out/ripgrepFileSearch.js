"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
var string_decoder_1 = require("string_decoder");
var normalization_1 = require("./normalization");
var ripgrep_1 = require("./ripgrep");
var ripgrepHelpers_1 = require("./ripgrepHelpers");
var ripgrepTextSearch_1 = require("./ripgrepTextSearch");
var isMac = process.platform === 'darwin';
// If vscode-ripgrep is in an .asar file, then the binary is unpacked.
var rgDiskPath = ripgrep_1.rgPath.replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');
var RipgrepFileSearchEngine = /** @class */ (function () {
    function RipgrepFileSearchEngine(outputChannel) {
        var _this = this;
        this.outputChannel = outputChannel;
        this.killRgProcFn = function () { return _this.rgProc && _this.rgProc.kill(); };
        process.once('exit', this.killRgProcFn);
    }
    RipgrepFileSearchEngine.prototype.dispose = function () {
        process.removeListener('exit', this.killRgProcFn);
    };
    RipgrepFileSearchEngine.prototype.provideFileSearchResults = function (options, progress, token) {
        var _this = this;
        this.outputChannel.appendLine("provideFileSearchResults " + JSON.stringify(__assign({}, options, {
            folder: options.folder.toString()
        })));
        return new Promise(function (resolve, reject) {
            var isDone = false;
            var cancel = function () {
                isDone = true;
                _this.rgProc.kill();
            };
            token.onCancellationRequested(cancel);
            var rgArgs = getRgArgs(options);
            var cwd = options.folder.fsPath;
            var escapedArgs = rgArgs
                .map(function (arg) { return arg.match(/^-/) ? arg : "'" + arg + "'"; })
                .join(' ');
            _this.outputChannel.appendLine("rg " + escapedArgs + "\n - cwd: " + cwd + "\n");
            _this.rgProc = cp.spawn(rgDiskPath, rgArgs, { cwd: cwd });
            _this.rgProc.on('error', function (e) {
                console.log(e);
                reject(e);
            });
            var leftover = '';
            _this.collectStdout(_this.rgProc, function (err, stdout, last) {
                if (err) {
                    reject(err);
                    return;
                }
                // Mac: uses NFD unicode form on disk, but we want NFC
                var normalized = leftover + (isMac ? normalization_1.normalizeNFC(stdout) : stdout);
                var relativeFiles = normalized.split('\n');
                if (last) {
                    var n = relativeFiles.length;
                    relativeFiles[n - 1] = relativeFiles[n - 1].trim();
                    if (!relativeFiles[n - 1]) {
                        relativeFiles.pop();
                    }
                }
                else {
                    leftover = relativeFiles.pop();
                }
                if (relativeFiles.length && relativeFiles[0].indexOf('\n') !== -1) {
                    reject(new Error('Splitting up files failed'));
                    return;
                }
                relativeFiles.forEach(function (relativeFile) {
                    progress.report(relativeFile);
                });
                if (last) {
                    if (isDone) {
                        resolve();
                    }
                    else {
                        // Trigger last result
                        _this.rgProc = null;
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    }
                }
            });
        }).then(function () { return _this.dispose(); }, function (err) {
            _this.dispose();
            return Promise.reject(err);
        });
    };
    RipgrepFileSearchEngine.prototype.collectStdout = function (cmd, cb) {
        var _this = this;
        var onData = function (err, stdout, last) {
            if (err || last) {
                onData = function () { };
            }
            cb(err, stdout, last);
        };
        if (cmd.stdout) {
            this.forwardData(cmd.stdout, onData);
        }
        else {
            this.outputChannel.appendLine('stdout is null');
        }
        var stderr = this.collectData(cmd.stderr);
        var gotData = false;
        cmd.stdout.once('data', function () { return gotData = true; });
        cmd.on('error', function (err) {
            onData(err);
        });
        cmd.on('close', function (code) {
            // ripgrep returns code=1 when no results are found
            var stderrText, displayMsg;
            if (!gotData && (stderrText = _this.decodeData(stderr)) && (displayMsg = ripgrepTextSearch_1.rgErrorMsgForDisplay(stderrText))) {
                onData(new Error("command failed with error code " + code + ": " + displayMsg));
            }
            else {
                onData(null, '', true);
            }
        });
    };
    RipgrepFileSearchEngine.prototype.forwardData = function (stream, cb) {
        var decoder = new string_decoder_1.StringDecoder();
        stream.on('data', function (data) {
            cb(null, decoder.write(data));
        });
        return decoder;
    };
    RipgrepFileSearchEngine.prototype.collectData = function (stream) {
        var buffers = [];
        stream.on('data', function (data) {
            buffers.push(data);
        });
        return buffers;
    };
    RipgrepFileSearchEngine.prototype.decodeData = function (buffers) {
        var decoder = new string_decoder_1.StringDecoder();
        return buffers.map(function (buffer) { return decoder.write(buffer); }).join('');
    };
    return RipgrepFileSearchEngine;
}());
exports.RipgrepFileSearchEngine = RipgrepFileSearchEngine;
function getRgArgs(options) {
    var args = ['--files', '--hidden', '--case-sensitive'];
    options.includes.forEach(function (globArg) {
        var inclusion = ripgrepHelpers_1.anchorGlob(globArg);
        args.push('-g', inclusion);
        if (isMac) {
            var normalized = normalization_1.normalizeNFD(inclusion);
            if (normalized !== inclusion) {
                args.push('-g', normalized);
            }
        }
    });
    options.excludes.forEach(function (globArg) {
        var exclusion = "!" + ripgrepHelpers_1.anchorGlob(globArg);
        args.push('-g', exclusion);
        if (isMac) {
            var normalized = normalization_1.normalizeNFD(exclusion);
            if (normalized !== exclusion) {
                args.push('-g', normalized);
            }
        }
    });
    if (options.useIgnoreFiles) {
        args.push('--no-ignore-parent');
    }
    else {
        // Don't use .gitignore or .ignore
        args.push('--no-ignore');
    }
    // Follow symlinks
    if (options.followSymlinks) {
        args.push('--follow');
    }
    // Folder to search
    args.push('--');
    args.push('.');
    return args;
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\search-rg\out/ripgrepFileSearch.js.map
