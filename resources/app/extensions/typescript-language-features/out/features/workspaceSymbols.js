"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const typeConverters = require("../utils/typeConverters");
function getSymbolKind(item) {
    switch (item.kind) {
        case 'method': return vscode.SymbolKind.Method;
        case 'enum': return vscode.SymbolKind.Enum;
        case 'function': return vscode.SymbolKind.Function;
        case 'class': return vscode.SymbolKind.Class;
        case 'interface': return vscode.SymbolKind.Interface;
        case 'var': return vscode.SymbolKind.Variable;
        default: return vscode.SymbolKind.Variable;
    }
}
class TypeScriptWorkspaceSymbolProvider {
    constructor(client, modeIds) {
        this.client = client;
        this.modeIds = modeIds;
    }
    async provideWorkspaceSymbols(search, token) {
        const uri = this.getUri();
        if (!uri) {
            return [];
        }
        const filepath = this.client.toPath(uri);
        if (!filepath) {
            return [];
        }
        const args = {
            file: filepath,
            searchValue: search
        };
        const response = await this.client.execute('navto', args, token);
        if (!response.body) {
            return [];
        }
        const result = [];
        for (const item of response.body) {
            if (!item.containerName && item.kind === 'alias') {
                continue;
            }
            const label = TypeScriptWorkspaceSymbolProvider.getLabel(item);
            result.push(new vscode.SymbolInformation(label, getSymbolKind(item), item.containerName || '', typeConverters.Location.fromTextSpan(this.client.toResource(item.file), item)));
        }
        return result;
    }
    static getLabel(item) {
        let label = item.name;
        if (item.kind === 'method' || item.kind === 'function') {
            label += '()';
        }
        return label;
    }
    getUri() {
        // typescript wants to have a resource even when asking
        // general questions so we check the active editor. If this
        // doesn't match we take the first TS document.
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document && this.modeIds.indexOf(document.languageId) >= 0) {
                return document.uri;
            }
        }
        const documents = vscode.workspace.textDocuments;
        for (const document of documents) {
            if (this.modeIds.indexOf(document.languageId) >= 0) {
                return document.uri;
            }
        }
        return undefined;
    }
}
function register(client, modeIds) {
    return vscode.languages.registerWorkspaceSymbolProvider(new TypeScriptWorkspaceSymbolProvider(client, modeIds));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\workspaceSymbols.js.map
