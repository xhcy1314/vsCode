"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const nls = require("vscode-nls");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const api_1 = require("../utils/api");
const localize = nls.loadMessageBundle(__filename);
const directives = [
    {
        value: '@ts-check',
        description: localize(0, null)
    }, {
        value: '@ts-nocheck',
        description: localize(1, null)
    }, {
        value: '@ts-ignore',
        description: localize(2, null)
    }
];
class DirectiveCommentCompletionProvider {
    constructor(client) {
        this.client = client;
    }
    provideCompletionItems(document, position, _token) {
        const file = this.client.toPath(document.uri);
        if (!file) {
            return [];
        }
        const line = document.lineAt(position.line).text;
        const prefix = line.slice(0, position.character);
        const match = prefix.match(/^\s*\/\/+\s?(@[a-zA-Z\-]*)?$/);
        if (match) {
            return directives.map(directive => {
                const item = new vscode.CompletionItem(directive.value, vscode.CompletionItemKind.Snippet);
                item.detail = directive.description;
                item.range = new vscode.Range(position.line, Math.max(0, position.character - (match[1] ? match[1].length : 0)), position.line, position.character);
                return item;
            });
        }
        return [];
    }
    resolveCompletionItem(item, _token) {
        return item;
    }
}
function register(selector, client) {
    return new dependentRegistration_1.VersionDependentRegistration(client, api_1.default.v230, () => {
        return vscode.languages.registerCompletionItemProvider(selector, new DirectiveCommentCompletionProvider(client), '@');
    });
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\directiveCommentCompletions.js.map
