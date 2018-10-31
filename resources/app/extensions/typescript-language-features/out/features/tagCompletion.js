"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const api_1 = require("../utils/api");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const typeConverters = require("../utils/typeConverters");
class TypeScriptTagCompletion {
    constructor(client) {
        this.client = client;
    }
    async provideCompletionItems(document, position, token, _context) {
        const filepath = this.client.toPath(document.uri);
        if (!filepath) {
            return undefined;
        }
        const args = typeConverters.Position.toFileLocationRequestArgs(filepath, position);
        let body = undefined;
        try {
            const response = await this.client.execute('jsxClosingTag', args, token);
            body = response && response.body;
            if (!body) {
                return undefined;
            }
        }
        catch (_a) {
            return undefined;
        }
        return [this.getCompletion(body)];
    }
    getCompletion(body) {
        const completion = new vscode.CompletionItem(body.newText);
        completion.insertText = this.getTagSnippet(body);
        return completion;
    }
    getTagSnippet(closingTag) {
        const snippet = new vscode.SnippetString();
        snippet.appendPlaceholder('', 0);
        snippet.appendText(closingTag.newText);
        return snippet;
    }
}
function register(selector, client) {
    return new dependentRegistration_1.VersionDependentRegistration(client, api_1.default.v300, () => vscode.languages.registerCompletionItemProvider(selector, new TypeScriptTagCompletion(client), '>'));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\tagCompletion.js.map
