"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const typeConverters = require("../utils/typeConverters");
class TypeScriptDocumentHighlightProvider {
    constructor(client) {
        this.client = client;
    }
    async provideDocumentHighlights(resource, position, token) {
        const file = this.client.toPath(resource.uri);
        if (!file) {
            return [];
        }
        const args = typeConverters.Position.toFileLocationRequestArgs(file, position);
        try {
            const response = await this.client.execute('occurrences', args, token);
            if (response && response.body) {
                return response.body
                    .filter(x => !x.isInString)
                    .map(documentHighlightFromOccurance);
            }
        }
        catch (_a) {
            // noop
        }
        return [];
    }
}
function documentHighlightFromOccurance(occurrence) {
    return new vscode.DocumentHighlight(typeConverters.Range.fromTextSpan(occurrence), occurrence.isWriteAccess ? vscode.DocumentHighlightKind.Write : vscode.DocumentHighlightKind.Read);
}
function register(selector, client) {
    return vscode.languages.registerDocumentHighlightProvider(selector, new TypeScriptDocumentHighlightProvider(client));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\documentHighlight.js.map
