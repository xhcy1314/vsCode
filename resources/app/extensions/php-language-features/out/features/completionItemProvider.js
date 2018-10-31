/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode_1 = require("vscode");
var phpGlobals = require("./phpGlobals");
var phpGlobalFunctions = require("./phpGlobalFunctions");
var PHPCompletionItemProvider = /** @class */ (function () {
    function PHPCompletionItemProvider() {
    }
    PHPCompletionItemProvider.prototype.provideCompletionItems = function (document, position, _token, context) {
        var result = [];
        var shouldProvideCompletionItems = vscode_1.workspace.getConfiguration('php').get('suggest.basic', true);
        if (!shouldProvideCompletionItems) {
            return Promise.resolve(result);
        }
        var range = document.getWordRangeAtPosition(position);
        var prefix = range ? document.getText(range) : '';
        if (!range) {
            range = new vscode_1.Range(position, position);
        }
        if (context.triggerCharacter === '>') {
            var twoBeforeCursor = new vscode_1.Position(position.line, Math.max(0, position.character - 2));
            var previousTwoChars = document.getText(new vscode_1.Range(twoBeforeCursor, position));
            if (previousTwoChars !== '->') {
                return Promise.resolve(result);
            }
        }
        var added = {};
        var createNewProposal = function (kind, name, entry) {
            var proposal = new vscode_1.CompletionItem(name);
            proposal.kind = kind;
            if (entry) {
                if (entry.description) {
                    proposal.documentation = entry.description;
                }
                if (entry.signature) {
                    proposal.detail = entry.signature;
                }
            }
            return proposal;
        };
        var matches = function (name) {
            return prefix.length === 0 || name.length >= prefix.length && name.substr(0, prefix.length) === prefix;
        };
        if (matches('php') && range.start.character >= 2) {
            var twoBeforePosition = new vscode_1.Position(range.start.line, range.start.character - 2);
            var beforeWord = document.getText(new vscode_1.Range(twoBeforePosition, range.start));
            if (beforeWord === '<?') {
                var proposal = createNewProposal(vscode_1.CompletionItemKind.Class, '<?php', null);
                proposal.textEdit = new vscode_1.TextEdit(new vscode_1.Range(twoBeforePosition, position), '<?php');
                result.push(proposal);
                return Promise.resolve(result);
            }
        }
        for (var globalvariables in phpGlobals.globalvariables) {
            if (phpGlobals.globalvariables.hasOwnProperty(globalvariables) && matches(globalvariables)) {
                added[globalvariables] = true;
                result.push(createNewProposal(vscode_1.CompletionItemKind.Variable, globalvariables, phpGlobals.globalvariables[globalvariables]));
            }
        }
        for (var globalfunctions in phpGlobalFunctions.globalfunctions) {
            if (phpGlobalFunctions.globalfunctions.hasOwnProperty(globalfunctions) && matches(globalfunctions)) {
                added[globalfunctions] = true;
                result.push(createNewProposal(vscode_1.CompletionItemKind.Function, globalfunctions, phpGlobalFunctions.globalfunctions[globalfunctions]));
            }
        }
        for (var compiletimeconstants in phpGlobals.compiletimeconstants) {
            if (phpGlobals.compiletimeconstants.hasOwnProperty(compiletimeconstants) && matches(compiletimeconstants)) {
                added[compiletimeconstants] = true;
                result.push(createNewProposal(vscode_1.CompletionItemKind.Field, compiletimeconstants, phpGlobals.compiletimeconstants[compiletimeconstants]));
            }
        }
        for (var keywords in phpGlobals.keywords) {
            if (phpGlobals.keywords.hasOwnProperty(keywords) && matches(keywords)) {
                added[keywords] = true;
                result.push(createNewProposal(vscode_1.CompletionItemKind.Keyword, keywords, phpGlobals.keywords[keywords]));
            }
        }
        var text = document.getText();
        if (prefix[0] === '$') {
            var variableMatch = /\$([a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)/g;
            var match = null;
            while (match = variableMatch.exec(text)) {
                var word = match[0];
                if (!added[word]) {
                    added[word] = true;
                    result.push(createNewProposal(vscode_1.CompletionItemKind.Variable, word, null));
                }
            }
        }
        var functionMatch = /function\s+([a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)\s*\(/g;
        var match2 = null;
        while (match2 = functionMatch.exec(text)) {
            var word2 = match2[1];
            if (!added[word2]) {
                added[word2] = true;
                result.push(createNewProposal(vscode_1.CompletionItemKind.Function, word2, null));
            }
        }
        return Promise.resolve(result);
    };
    return PHPCompletionItemProvider;
}());
exports.default = PHPCompletionItemProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\php-language-features\out/features\completionItemProvider.js.map
