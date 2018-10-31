/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var events_1 = require("events");
var string_decoder_1 = require("string_decoder");
var vscode = require("vscode");
var ripgrep_1 = require("./ripgrep");
var ripgrepHelpers_1 = require("./ripgrepHelpers");
// If vscode-ripgrep is in an .asar file, then the binary is unpacked.
var rgDiskPath = ripgrep_1.rgPath.replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');
// TODO@roblou move to SearchService
var MAX_TEXT_RESULTS = 10000;
var RipgrepTextSearchEngine = /** @class */ (function () {
    function RipgrepTextSearchEngine(outputChannel) {
        var _this = this;
        this.outputChannel = outputChannel;
        this.isDone = false;
        this.killRgProcFn = function () { return _this.rgProc && _this.rgProc.kill(); };
    }
    RipgrepTextSearchEngine.prototype.provideTextSearchResults = function (query, options, progress, token) {
        var _this = this;
        this.outputChannel.appendLine("provideTextSearchResults " + query.pattern + ", " + JSON.stringify(__assign({}, options, {
            folder: options.folder.toString()
        })));
        return new Promise(function (resolve, reject) {
            var cancel = function () {
                _this.isDone = true;
                _this.ripgrepParser.cancel();
                _this.rgProc.kill();
            };
            token.onCancellationRequested(cancel);
            var rgArgs = getRgArgs(query, options);
            var cwd = options.folder.fsPath;
            var escapedArgs = rgArgs
                .map(function (arg) { return arg.match(/^-/) ? arg : "'" + arg + "'"; })
                .join(' ');
            _this.outputChannel.appendLine("rg " + escapedArgs + "\n - cwd: " + cwd);
            _this.rgProc = cp.spawn(rgDiskPath, rgArgs, { cwd: cwd });
            process.once('exit', _this.killRgProcFn);
            _this.rgProc.on('error', function (e) {
                console.error(e);
                _this.outputChannel.append('Error: ' + (e && e.message));
                reject(e);
            });
            var gotResult = false;
            _this.ripgrepParser = new RipgrepParser(MAX_TEXT_RESULTS, cwd);
            _this.ripgrepParser.on('result', function (match) {
                gotResult = true;
                progress.report(match);
            });
            _this.ripgrepParser.on('hitLimit', function () {
                cancel();
            });
            _this.rgProc.stdout.on('data', function (data) {
                _this.ripgrepParser.handleData(data);
            });
            var gotData = false;
            _this.rgProc.stdout.once('data', function () { return gotData = true; });
            var stderr = '';
            _this.rgProc.stderr.on('data', function (data) {
                var message = data.toString();
                _this.outputChannel.append(message);
                stderr += message;
            });
            _this.rgProc.on('close', function (code) {
                _this.outputChannel.appendLine(gotData ? 'Got data from stdout' : 'No data from stdout');
                _this.outputChannel.appendLine(gotResult ? 'Got result from parser' : 'No result from parser');
                _this.outputChannel.appendLine('');
                process.removeListener('exit', _this.killRgProcFn);
                if (_this.isDone) {
                    resolve();
                }
                else {
                    // Trigger last result
                    _this.ripgrepParser.flush();
                    _this.rgProc = null;
                    var displayMsg = void 0;
                    if (stderr && !gotData && (displayMsg = rgErrorMsgForDisplay(stderr))) {
                        reject(new Error(displayMsg));
                    }
                    else {
                        resolve();
                    }
                }
            });
        });
    };
    return RipgrepTextSearchEngine;
}());
exports.RipgrepTextSearchEngine = RipgrepTextSearchEngine;
/**
 * Read the first line of stderr and return an error for display or undefined, based on a whitelist.
 * Ripgrep produces stderr output which is not from a fatal error, and we only want the search to be
 * "failed" when a fatal error was produced.
 */
function rgErrorMsgForDisplay(msg) {
    var firstLine = msg.split('\n')[0].trim();
    if (firstLine.startsWith('Error parsing regex')) {
        return firstLine;
    }
    if (firstLine.startsWith('error parsing glob') ||
        firstLine.startsWith('unsupported encoding')) {
        // Uppercase first letter
        return firstLine.charAt(0).toUpperCase() + firstLine.substr(1);
    }
    if (firstLine === "Literal '\\n' not allowed.") {
        // I won't localize this because none of the Ripgrep error messages are localized
        return "Literal '\\n' currently not supported";
    }
    if (firstLine.startsWith('Literal ')) {
        // Other unsupported chars
        return firstLine;
    }
    return undefined;
}
exports.rgErrorMsgForDisplay = rgErrorMsgForDisplay;
var RipgrepParser = /** @class */ (function (_super) {
    __extends(RipgrepParser, _super);
    function RipgrepParser(maxResults, rootFolder) {
        var _this = _super.call(this) || this;
        _this.maxResults = maxResults;
        _this.rootFolder = rootFolder;
        _this.numResults = 0;
        _this.stringDecoder = new string_decoder_1.StringDecoder();
        return _this;
    }
    RipgrepParser.prototype.cancel = function () {
        this.isDone = true;
    };
    RipgrepParser.prototype.flush = function () {
        this.handleDecodedData(this.stringDecoder.end());
    };
    RipgrepParser.prototype.handleData = function (data) {
        var dataStr = typeof data === 'string' ? data : this.stringDecoder.write(data);
        this.handleDecodedData(dataStr);
    };
    RipgrepParser.prototype.handleDecodedData = function (decodedData) {
        // If the previous data chunk didn't end in a newline, prepend it to this chunk
        var dataStr = this.remainder ?
            this.remainder + decodedData :
            decodedData;
        var dataLines = dataStr.split(/\r\n|\n/);
        this.remainder = dataLines[dataLines.length - 1] ? dataLines.pop() : null;
        for (var l = 0; l < dataLines.length; l++) {
            var outputLine = dataLines[l].trim();
            if (this.isDone) {
                break;
            }
            var r = void 0;
            if (r = outputLine.match(RipgrepParser.RESULT_REGEX)) {
                var lineNum = parseInt(r[1]) - 1;
                var matchText = r[2];
                // workaround https://github.com/BurntSushi/ripgrep/issues/416
                // If the match line ended with \r, append a match end marker so the match isn't lost
                if (r[3]) {
                    matchText += RipgrepParser.MATCH_END_MARKER;
                }
                // Line is a result - add to collected results for the current file path
                this.handleMatchLine(outputLine, lineNum, matchText);
            }
            else if (r = outputLine.match(RipgrepParser.FILE_REGEX)) {
                this.currentFile = r[1];
            }
            else {
                // Line is empty (or malformed)
            }
        }
    };
    RipgrepParser.prototype.handleMatchLine = function (outputLine, lineNum, lineText) {
        var _this = this;
        if (lineNum === 0) {
            lineText = stripUTF8BOM(lineText);
        }
        // if (!this.currentFile) {
        // 	// When searching a single file and no folderQueries, rg does not print the file line, so create it here
        // 	const singleFile = this.extraSearchFiles[0];
        // 	if (!singleFile) {
        // 		throw new Error('Got match line for unknown file');
        // 	}
        // 	this.currentFile = this.getFileUri(singleFile);
        // }
        var lastMatchEndPos = 0;
        var matchTextStartPos = -1;
        // Track positions with color codes subtracted - offsets in the final text preview result
        var matchTextStartRealIdx = -1;
        var textRealIdx = 0;
        var hitLimit = false;
        var realTextParts = [];
        var lineMatches = [];
        for (var i = 0; i < lineText.length - (RipgrepParser.MATCH_END_MARKER.length - 1);) {
            if (lineText.charCodeAt(i) === RipgrepParser.ESC_CODE) {
                if (lineText.substr(i, RipgrepParser.MATCH_START_MARKER.length) === RipgrepParser.MATCH_START_MARKER) {
                    // Match start
                    var chunk_1 = lineText.slice(lastMatchEndPos, i);
                    realTextParts.push(chunk_1);
                    i += RipgrepParser.MATCH_START_MARKER.length;
                    matchTextStartPos = i;
                    matchTextStartRealIdx = textRealIdx;
                }
                else if (lineText.substr(i, RipgrepParser.MATCH_END_MARKER.length) === RipgrepParser.MATCH_END_MARKER) {
                    // Match end
                    var chunk_2 = lineText.slice(matchTextStartPos, i);
                    realTextParts.push(chunk_2);
                    if (!hitLimit) {
                        var startCol = matchTextStartRealIdx;
                        var endCol = textRealIdx;
                        // actually have to finish parsing the line, and use the real ones
                        lineMatches.push(new vscode.Range(lineNum, startCol, lineNum, endCol));
                    }
                    matchTextStartPos = -1;
                    matchTextStartRealIdx = -1;
                    i += RipgrepParser.MATCH_END_MARKER.length;
                    lastMatchEndPos = i;
                    this.numResults++;
                    // Check hit maxResults limit
                    if (this.numResults >= this.maxResults) {
                        // Finish the line, then report the result below
                        hitLimit = true;
                    }
                }
                else {
                    // ESC char in file
                    i++;
                    textRealIdx++;
                }
            }
            else {
                // Some other char
                i++;
                textRealIdx++;
            }
        }
        var chunk = lineText.slice(lastMatchEndPos);
        realTextParts.push(chunk);
        // Get full real text line without color codes
        var preview = realTextParts.join('');
        lineMatches
            .map(function (range) {
            return {
                path: _this.currentFile,
                range: range,
                preview: {
                    text: preview,
                    match: new vscode.Range(0, range.start.character, 0, range.end.character)
                }
            };
        })
            .forEach(function (match) { return _this.onResult(match); });
        if (hitLimit) {
            this.cancel();
            this.emit('hitLimit');
        }
    };
    RipgrepParser.prototype.onResult = function (match) {
        this.emit('result', match);
    };
    RipgrepParser.RESULT_REGEX = /^\u001b\[0m(\d+)\u001b\[0m:(.*)(\r?)/;
    RipgrepParser.FILE_REGEX = /^\u001b\[0m(.+)\u001b\[0m$/;
    RipgrepParser.ESC_CODE = '\u001b'.charCodeAt(0);
    // public for test
    RipgrepParser.MATCH_START_MARKER = '\u001b[0m\u001b[31m';
    RipgrepParser.MATCH_END_MARKER = '\u001b[0m';
    return RipgrepParser;
}(events_1.EventEmitter));
exports.RipgrepParser = RipgrepParser;
function getRgArgs(query, options) {
    var args = ['--hidden', '--heading', '--line-number', '--color', 'ansi', '--colors', 'path:none', '--colors', 'line:none', '--colors', 'match:fg:red', '--colors', 'match:style:nobold'];
    args.push(query.isCaseSensitive ? '--case-sensitive' : '--ignore-case');
    options.includes
        .map(ripgrepHelpers_1.anchorGlob)
        .forEach(function (globArg) { return args.push('-g', globArg); });
    options.excludes
        .map(ripgrepHelpers_1.anchorGlob)
        .forEach(function (rgGlob) { return args.push('-g', "!" + rgGlob); });
    if (options.maxFileSize) {
        args.push('--max-filesize', options.maxFileSize + '');
    }
    if (options.useIgnoreFiles) {
        args.push('--no-ignore-parent');
    }
    else {
        // Don't use .gitignore or .ignore
        args.push('--no-ignore');
    }
    if (options.followSymlinks) {
        args.push('--follow');
    }
    if (options.encoding) {
        args.push('--encoding', options.encoding);
    }
    // Ripgrep handles -- as a -- arg separator. Only --.
    // - is ok, --- is ok, --some-flag is handled as query text. Need to special case.
    if (query.pattern === '--') {
        query.isRegExp = true;
        query.pattern = '\\-\\-';
    }
    var searchPatternAfterDoubleDashes;
    if (query.isWordMatch) {
        var regexp = createRegExp(query.pattern, query.isRegExp, { wholeWord: query.isWordMatch });
        var regexpStr = regexp.source.replace(/\\\//g, '/'); // RegExp.source arbitrarily returns escaped slashes. Search and destroy.
        args.push('--regexp', regexpStr);
    }
    else if (query.isRegExp) {
        args.push('--regexp', fixRegexEndingPattern(query.pattern));
    }
    else {
        searchPatternAfterDoubleDashes = query.pattern;
        args.push('--fixed-strings');
    }
    args.push('--no-config');
    // Folder to search
    args.push('--');
    if (searchPatternAfterDoubleDashes) {
        // Put the query after --, in case the query starts with a dash
        args.push(searchPatternAfterDoubleDashes);
    }
    args.push('.');
    return args;
}
function createRegExp(searchString, isRegex, options) {
    if (options === void 0) { options = {}; }
    if (!searchString) {
        throw new Error('Cannot create regex from empty string');
    }
    if (!isRegex) {
        searchString = escapeRegExpCharacters(searchString);
    }
    if (options.wholeWord) {
        if (!/\B/.test(searchString.charAt(0))) {
            searchString = '\\b' + searchString;
        }
        if (!/\B/.test(searchString.charAt(searchString.length - 1))) {
            searchString = searchString + '\\b';
        }
    }
    var modifiers = '';
    if (options.global) {
        modifiers += 'g';
    }
    if (!options.matchCase) {
        modifiers += 'i';
    }
    if (options.multiline) {
        modifiers += 'm';
    }
    return new RegExp(searchString, modifiers);
}
/**
 * Escapes regular expression characters in a given string
 */
function escapeRegExpCharacters(value) {
    return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\[\]\(\)\#]/g, '\\$&');
}
// -- UTF-8 BOM
var UTF8_BOM = 65279;
var UTF8_BOM_CHARACTER = String.fromCharCode(UTF8_BOM);
function startsWithUTF8BOM(str) {
    return (str && str.length > 0 && str.charCodeAt(0) === UTF8_BOM);
}
function stripUTF8BOM(str) {
    return startsWithUTF8BOM(str) ? str.substr(1) : str;
}
function fixRegexEndingPattern(pattern) {
    // Replace an unescaped $ at the end of the pattern with \r?$
    // Match $ preceeded by none or even number of literal \
    return pattern.match(/([^\\]|^)(\\\\)*\$$/) ?
        pattern.replace(/\$$/, '\\r?$') :
        pattern;
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\search-rg\out/ripgrepTextSearch.js.map
