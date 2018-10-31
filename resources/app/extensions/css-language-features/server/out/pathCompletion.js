/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var fs = require("fs");
var vscode_uri_1 = require("vscode-uri");
var vscode_languageserver_types_1 = require("vscode-languageserver-types");
var strings_1 = require("./utils/strings");
function getPathCompletionParticipant(document, workspaceFolders, result) {
    return {
        onCssURILiteralValue: function (_a) {
            var position = _a.position, range = _a.range, uriValue = _a.uriValue;
            var isValueQuoted = strings_1.startsWith(uriValue, "'") || strings_1.startsWith(uriValue, "\"");
            var fullValue = stripQuotes(uriValue);
            var valueBeforeCursor = isValueQuoted
                ? fullValue.slice(0, position.character - (range.start.character + 1))
                : fullValue.slice(0, position.character - range.start.character);
            if (fullValue === '.' || fullValue === '..') {
                result.isIncomplete = true;
                return;
            }
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return;
            }
            var workspaceRoot = resolveWorkspaceRoot(document, workspaceFolders);
            var paths = providePaths(valueBeforeCursor, vscode_uri_1.default.parse(document.uri).fsPath, workspaceRoot);
            var fullValueRange = isValueQuoted ? shiftRange(range, 1, -1) : range;
            var replaceRange = pathToReplaceRange(valueBeforeCursor, fullValue, fullValueRange);
            var suggestions = paths.map(function (p) { return pathToSuggestion(p, replaceRange); });
            result.items = suggestions.concat(result.items);
        }
    };
}
exports.getPathCompletionParticipant = getPathCompletionParticipant;
function stripQuotes(fullValue) {
    if (strings_1.startsWith(fullValue, "'") || strings_1.startsWith(fullValue, "\"")) {
        return fullValue.slice(1, -1);
    }
    else {
        return fullValue;
    }
}
/**
 * Get a list of path suggestions. Folder suggestions are suffixed with a slash.
 */
function providePaths(valueBeforeCursor, activeDocFsPath, root) {
    if (strings_1.startsWith(valueBeforeCursor, '/') && !root) {
        return [];
    }
    var lastIndexOfSlash = valueBeforeCursor.lastIndexOf('/');
    var valueBeforeLastSlash = valueBeforeCursor.slice(0, lastIndexOfSlash + 1);
    var parentDir = strings_1.startsWith(valueBeforeCursor, '/')
        ? path.resolve(root, '.' + valueBeforeLastSlash)
        : path.resolve(activeDocFsPath, '..', valueBeforeLastSlash);
    try {
        return fs.readdirSync(parentDir).map(function (f) {
            return isDir(path.resolve(parentDir, f))
                ? f + '/'
                : f;
        });
    }
    catch (e) {
        return [];
    }
}
var isDir = function (p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch (e) {
        return false;
    }
};
function pathToReplaceRange(valueBeforeCursor, fullValue, fullValueRange) {
    var replaceRange;
    var lastIndexOfSlash = valueBeforeCursor.lastIndexOf('/');
    if (lastIndexOfSlash === -1) {
        replaceRange = fullValueRange;
    }
    else {
        // For cases where cursor is in the middle of attribute value, like <script src="./s|rc/test.js">
        // Find the last slash before cursor, and calculate the start of replace range from there
        var valueAfterLastSlash = fullValue.slice(lastIndexOfSlash + 1);
        var startPos = shiftPosition(fullValueRange.end, -valueAfterLastSlash.length);
        // If whitespace exists, replace until it
        var whiteSpaceIndex = valueAfterLastSlash.indexOf(' ');
        var endPos = void 0;
        if (whiteSpaceIndex !== -1) {
            endPos = shiftPosition(startPos, whiteSpaceIndex);
        }
        else {
            endPos = fullValueRange.end;
        }
        replaceRange = vscode_languageserver_types_1.Range.create(startPos, endPos);
    }
    return replaceRange;
}
function pathToSuggestion(p, replaceRange) {
    var isDir = p[p.length - 1] === '/';
    if (isDir) {
        return {
            label: escapePath(p),
            kind: vscode_languageserver_types_1.CompletionItemKind.Folder,
            textEdit: vscode_languageserver_types_1.TextEdit.replace(replaceRange, escapePath(p)),
            command: {
                title: 'Suggest',
                command: 'editor.action.triggerSuggest'
            }
        };
    }
    else {
        return {
            label: escapePath(p),
            kind: vscode_languageserver_types_1.CompletionItemKind.File,
            textEdit: vscode_languageserver_types_1.TextEdit.replace(replaceRange, escapePath(p))
        };
    }
}
// Escape https://www.w3.org/TR/CSS1/#url
function escapePath(p) {
    return p.replace(/(\s|\(|\)|,|"|')/g, '\\$1');
}
function resolveWorkspaceRoot(activeDoc, workspaceFolders) {
    for (var i = 0; i < workspaceFolders.length; i++) {
        if (strings_1.startsWith(activeDoc.uri, workspaceFolders[i].uri)) {
            return path.resolve(vscode_uri_1.default.parse(workspaceFolders[i].uri).fsPath);
        }
    }
}
function shiftPosition(pos, offset) {
    return vscode_languageserver_types_1.Position.create(pos.line, pos.character + offset);
}
function shiftRange(range, startOffset, endOffset) {
    var start = shiftPosition(range.start, startOffset);
    var end = shiftPosition(range.end, endOffset);
    return vscode_languageserver_types_1.Range.create(start, end);
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\css-language-features\server\out/pathCompletion.js.map
