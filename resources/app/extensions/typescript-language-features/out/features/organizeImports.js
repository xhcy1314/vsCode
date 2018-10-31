"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const nls = require("vscode-nls");
const typeconverts = require("../utils/typeConverters");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const api_1 = require("../utils/api");
const localize = nls.loadMessageBundle(__filename);
class OrganizeImportsCommand {
    constructor(client) {
        this.client = client;
        this.id = OrganizeImportsCommand.Id;
    }
    async execute(file) {
        const args = {
            scope: {
                type: 'file',
                args: {
                    file
                }
            }
        };
        const response = await this.client.execute('organizeImports', args);
        if (!response || !response.success) {
            return false;
        }
        const edits = typeconverts.WorkspaceEdit.fromFileCodeEdits(this.client, response.body);
        return await vscode.workspace.applyEdit(edits);
    }
}
OrganizeImportsCommand.Id = '_typescript.organizeImports';
class OrganizeImportsCodeActionProvider {
    constructor(client, commandManager, fileConfigManager) {
        this.client = client;
        this.fileConfigManager = fileConfigManager;
        this.metadata = {
            providedCodeActionKinds: [vscode.CodeActionKind.SourceOrganizeImports]
        };
        commandManager.register(new OrganizeImportsCommand(client));
    }
    provideCodeActions(document, _range, _context, token) {
        const file = this.client.toPath(document.uri);
        if (!file) {
            return [];
        }
        this.fileConfigManager.ensureConfigurationForDocument(document, token);
        const action = new vscode.CodeAction(localize(0, null), vscode.CodeActionKind.SourceOrganizeImports);
        action.command = { title: '', command: OrganizeImportsCommand.Id, arguments: [file] };
        return [action];
    }
}
exports.OrganizeImportsCodeActionProvider = OrganizeImportsCodeActionProvider;
function register(selector, client, commandManager, fileConfigurationManager) {
    return new dependentRegistration_1.VersionDependentRegistration(client, api_1.default.v280, () => {
        const organizeImportsProvider = new OrganizeImportsCodeActionProvider(client, commandManager, fileConfigurationManager);
        return vscode.languages.registerCodeActionsProvider(selector, organizeImportsProvider, organizeImportsProvider.metadata);
    });
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\organizeImports.js.map
