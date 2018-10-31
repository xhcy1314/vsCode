"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const typeConverters = require("../utils/typeConverters");
class TypeScriptRenameProvider {
    constructor(client) {
        this.client = client;
    }
    async provideRenameEdits(document, position, newName, token) {
        const file = this.client.toPath(document.uri);
        if (!file) {
            return null;
        }
        const args = Object.assign({}, typeConverters.Position.toFileLocationRequestArgs(file, position), { findInStrings: false, findInComments: false });
        try {
            const response = await this.client.execute('rename', args, token);
            if (!response.body) {
                return null;
            }
            const renameInfo = response.body.info;
            if (!renameInfo.canRename) {
                return Promise.reject(renameInfo.localizedErrorMessage);
            }
            return this.toWorkspaceEdit(response.body.locs, newName);
        }
        catch (_a) {
            // noop
        }
        return null;
    }
    toWorkspaceEdit(locations, newName) {
        const result = new vscode.WorkspaceEdit();
        for (const spanGroup of locations) {
            const resource = this.client.toResource(spanGroup.file);
            if (resource) {
                for (const textSpan of spanGroup.locs) {
                    result.replace(resource, typeConverters.Range.fromTextSpan(textSpan), newName);
                }
            }
        }
        return result;
    }
}
function register(selector, client) {
    return vscode.languages.registerRenameProvider(selector, new TypeScriptRenameProvider(client));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\rename.js.map
