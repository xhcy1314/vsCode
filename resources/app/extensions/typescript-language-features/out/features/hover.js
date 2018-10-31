"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const previewer_1 = require("../utils/previewer");
const typeConverters = require("../utils/typeConverters");
class TypeScriptHoverProvider {
    constructor(client) {
        this.client = client;
    }
    async provideHover(document, position, token) {
        const filepath = this.client.toPath(document.uri);
        if (!filepath) {
            return undefined;
        }
        const args = typeConverters.Position.toFileLocationRequestArgs(filepath, position);
        try {
            const response = await this.client.execute('quickinfo', args, token);
            if (response && response.body) {
                const data = response.body;
                return new vscode.Hover(TypeScriptHoverProvider.getContents(data), typeConverters.Range.fromTextSpan(data));
            }
        }
        catch (e) {
            // noop
        }
        return undefined;
    }
    static getContents(data) {
        const parts = [];
        if (data.displayString) {
            parts.push({ language: 'typescript', value: data.displayString });
        }
        const tags = previewer_1.tagsMarkdownPreview(data.tags);
        parts.push(data.documentation + (tags ? '\n\n' + tags : ''));
        return parts;
    }
}
function register(selector, client) {
    return vscode.languages.registerHoverProvider(selector, new TypeScriptHoverProvider(client));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\hover.js.map
