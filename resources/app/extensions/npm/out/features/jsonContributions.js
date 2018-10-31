/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const jsonc_parser_1 = require("jsonc-parser");
const path_1 = require("path");
const bowerJSONContribution_1 = require("./bowerJSONContribution");
const packageJSONContribution_1 = require("./packageJSONContribution");
const vscode_1 = require("vscode");
function addJSONProviders(xhr) {
    const contributions = [new packageJSONContribution_1.PackageJSONContribution(xhr), new bowerJSONContribution_1.BowerJSONContribution(xhr)];
    const subscriptions = [];
    contributions.forEach(contribution => {
        const selector = contribution.getDocumentSelector();
        subscriptions.push(vscode_1.languages.registerCompletionItemProvider(selector, new JSONCompletionItemProvider(contribution), '"', ':'));
        subscriptions.push(vscode_1.languages.registerHoverProvider(selector, new JSONHoverProvider(contribution)));
    });
    return vscode_1.Disposable.from(...subscriptions);
}
exports.addJSONProviders = addJSONProviders;
class JSONHoverProvider {
    constructor(jsonContribution) {
        this.jsonContribution = jsonContribution;
    }
    provideHover(document, position, _token) {
        const fileName = path_1.basename(document.fileName);
        const offset = document.offsetAt(position);
        const location = jsonc_parser_1.getLocation(document.getText(), offset);
        if (!location.previousNode) {
            return null;
        }
        const node = location.previousNode;
        if (node && node.offset <= offset && offset <= node.offset + node.length) {
            const promise = this.jsonContribution.getInfoContribution(fileName, location);
            if (promise) {
                return promise.then(htmlContent => {
                    const range = new vscode_1.Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
                    const result = {
                        contents: htmlContent || [],
                        range: range
                    };
                    return result;
                });
            }
        }
        return null;
    }
}
exports.JSONHoverProvider = JSONHoverProvider;
class JSONCompletionItemProvider {
    constructor(jsonContribution) {
        this.jsonContribution = jsonContribution;
    }
    resolveCompletionItem(item, _token) {
        if (this.jsonContribution.resolveSuggestion) {
            const resolver = this.jsonContribution.resolveSuggestion(item);
            if (resolver) {
                return resolver;
            }
        }
        return Promise.resolve(item);
    }
    provideCompletionItems(document, position, _token) {
        const fileName = path_1.basename(document.fileName);
        const currentWord = this.getCurrentWord(document, position);
        let overwriteRange;
        const items = [];
        let isIncomplete = false;
        const offset = document.offsetAt(position);
        const location = jsonc_parser_1.getLocation(document.getText(), offset);
        const node = location.previousNode;
        if (node && node.offset <= offset && offset <= node.offset + node.length && (node.type === 'property' || node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null')) {
            overwriteRange = new vscode_1.Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
        }
        else {
            overwriteRange = new vscode_1.Range(document.positionAt(offset - currentWord.length), position);
        }
        const proposed = {};
        const collector = {
            add: (suggestion) => {
                if (!proposed[suggestion.label]) {
                    proposed[suggestion.label] = true;
                    suggestion.range = overwriteRange;
                    items.push(suggestion);
                }
            },
            setAsIncomplete: () => isIncomplete = true,
            error: (message) => console.error(message),
            log: (message) => console.log(message)
        };
        let collectPromise = null;
        if (location.isAtPropertyKey) {
            const addValue = !location.previousNode || !location.previousNode.columnOffset;
            const isLast = this.isLast(document, position);
            collectPromise = this.jsonContribution.collectPropertySuggestions(fileName, location, currentWord, addValue, isLast, collector);
        }
        else {
            if (location.path.length === 0) {
                collectPromise = this.jsonContribution.collectDefaultSuggestions(fileName, collector);
            }
            else {
                collectPromise = this.jsonContribution.collectValueSuggestions(fileName, location, collector);
            }
        }
        if (collectPromise) {
            return collectPromise.then(() => {
                if (items.length > 0) {
                    return new vscode_1.CompletionList(items, isIncomplete);
                }
                return null;
            });
        }
        return null;
    }
    getCurrentWord(document, position) {
        let i = position.character - 1;
        const text = document.lineAt(position.line).text;
        while (i >= 0 && ' \t\n\r\v":{[,'.indexOf(text.charAt(i)) === -1) {
            i--;
        }
        return text.substring(i + 1, position.character);
    }
    isLast(document, position) {
        const scanner = jsonc_parser_1.createScanner(document.getText(), true);
        scanner.setPosition(document.offsetAt(position));
        let nextToken = scanner.scan();
        if (nextToken === jsonc_parser_1.SyntaxKind.StringLiteral && scanner.getTokenError() === jsonc_parser_1.ScanError.UnexpectedEndOfString) {
            nextToken = scanner.scan();
        }
        return nextToken === jsonc_parser_1.SyntaxKind.CloseBraceToken || nextToken === jsonc_parser_1.SyntaxKind.EOF;
    }
}
exports.JSONCompletionItemProvider = JSONCompletionItemProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\npm\out/features\jsonContributions.js.map
