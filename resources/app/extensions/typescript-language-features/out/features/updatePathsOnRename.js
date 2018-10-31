"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const nls = require("vscode-nls");
const api_1 = require("../utils/api");
const languageIds = require("../utils/languageModeIds");
const typeConverters = require("../utils/typeConverters");
const fileSchemes = require("../utils/fileSchemes");
const regexp_1 = require("../utils/regexp");
const localize = nls.loadMessageBundle(__filename);
const updateImportsOnFileMoveName = 'updateImportsOnFileMove.enabled';
var UpdateImportsOnFileMoveSetting;
(function (UpdateImportsOnFileMoveSetting) {
    UpdateImportsOnFileMoveSetting["Prompt"] = "prompt";
    UpdateImportsOnFileMoveSetting["Always"] = "always";
    UpdateImportsOnFileMoveSetting["Never"] = "never";
})(UpdateImportsOnFileMoveSetting || (UpdateImportsOnFileMoveSetting = {}));
class UpdateImportsOnFileRenameHandler {
    constructor(client, fileConfigurationManager, _handles) {
        this.client = client;
        this.fileConfigurationManager = fileConfigurationManager;
        this._handles = _handles;
        this._onDidRenameSub = vscode.workspace.onDidRenameFile(e => {
            this.doRename(e.oldUri, e.newUri);
        });
    }
    dispose() {
        this._onDidRenameSub.dispose();
    }
    async doRename(oldResource, newResource) {
        if (!this.client.apiVersion.gte(api_1.default.v290)) {
            return;
        }
        const targetResource = await this.getTargetResource(newResource);
        if (!targetResource) {
            return;
        }
        const targetFile = this.client.toPath(targetResource);
        if (!targetFile) {
            return;
        }
        const newFile = this.client.toPath(newResource);
        if (!newFile) {
            return;
        }
        const oldFile = this.client.toPath(oldResource);
        if (!oldFile) {
            return;
        }
        const document = await vscode.workspace.openTextDocument(targetResource);
        const config = this.getConfiguration(document);
        const setting = config.get(updateImportsOnFileMoveName);
        if (setting === UpdateImportsOnFileMoveSetting.Never) {
            return;
        }
        // Make sure TS knows about file
        this.client.bufferSyncSupport.closeResource(targetResource);
        this.client.bufferSyncSupport.openTextDocument(document);
        // Workaround for https://github.com/Microsoft/vscode/issues/52967
        // Never attempt to update import paths if the file does not contain something the looks like an export
        const tree = await this.client.execute('navtree', { file: newFile });
        const hasExport = (node) => {
            return !!node.kindModifiers.match(/\bexport\b/g) || !!(node.childItems && node.childItems.some(hasExport));
        };
        if (!tree.body || !tree.body || !hasExport(tree.body)) {
            return;
        }
        const edits = await this.getEditsForFileRename(targetFile, document, oldFile, newFile);
        if (!edits || !edits.size) {
            return;
        }
        if (await this.confirmActionWithUser(newResource, document)) {
            await vscode.workspace.applyEdit(edits);
        }
    }
    async confirmActionWithUser(newResource, newDocument) {
        const config = this.getConfiguration(newDocument);
        const setting = config.get(updateImportsOnFileMoveName);
        switch (setting) {
            case UpdateImportsOnFileMoveSetting.Always:
                return true;
            case UpdateImportsOnFileMoveSetting.Never:
                return false;
            case UpdateImportsOnFileMoveSetting.Prompt:
            default:
                return this.promptUser(newResource, newDocument);
        }
    }
    getConfiguration(newDocument) {
        return vscode.workspace.getConfiguration(isTypeScriptDocument(newDocument) ? 'typescript' : 'javascript', newDocument.uri);
    }
    async promptUser(newResource, newDocument) {
        let Choice;
        (function (Choice) {
            Choice[Choice["None"] = 0] = "None";
            Choice[Choice["Accept"] = 1] = "Accept";
            Choice[Choice["Reject"] = 2] = "Reject";
            Choice[Choice["Always"] = 3] = "Always";
            Choice[Choice["Never"] = 4] = "Never";
        })(Choice || (Choice = {}));
        const response = await vscode.window.showInformationMessage(localize(0, null, path.basename(newResource.fsPath)), {
            modal: true,
        }, {
            title: localize(1, null),
            choice: Choice.Reject,
            isCloseAffordance: true,
        }, {
            title: localize(2, null),
            choice: Choice.Accept,
        }, {
            title: localize(3, null),
            choice: Choice.Always,
        }, {
            title: localize(4, null),
            choice: Choice.Never,
        });
        if (!response) {
            return false;
        }
        switch (response.choice) {
            case Choice.Accept:
                {
                    return true;
                }
            case Choice.Reject:
                {
                    return false;
                }
            case Choice.Always:
                {
                    const config = this.getConfiguration(newDocument);
                    config.update(updateImportsOnFileMoveName, UpdateImportsOnFileMoveSetting.Always, vscode.ConfigurationTarget.Global);
                    return true;
                }
            case Choice.Never:
                {
                    const config = this.getConfiguration(newDocument);
                    config.update(updateImportsOnFileMoveName, UpdateImportsOnFileMoveSetting.Never, vscode.ConfigurationTarget.Global);
                    return false;
                }
        }
        return false;
    }
    async getTargetResource(resource) {
        if (resource.scheme !== fileSchemes.file) {
            return undefined;
        }
        if (this.client.apiVersion.gte(api_1.default.v292) && fs.lstatSync(resource.fsPath).isDirectory()) {
            const files = await vscode.workspace.findFiles({
                base: resource.fsPath,
                pattern: '**/*.{ts,tsx,js,jsx}',
            }, '**/node_modules/**', 1);
            return files[0];
        }
        return (await this._handles(resource)) ? resource : undefined;
    }
    async getEditsForFileRename(targetResource, document, oldFile, newFile) {
        const isDirectoryRename = fs.lstatSync(newFile).isDirectory();
        await this.fileConfigurationManager.ensureConfigurationForDocument(document, undefined);
        const args = {
            file: targetResource,
            oldFilePath: oldFile,
            newFilePath: newFile,
        };
        const response = await this.client.execute('getEditsForFileRename', args);
        if (!response || !response.body) {
            return;
        }
        const edits = [];
        for (const edit of response.body) {
            // Workaround for https://github.com/Microsoft/vscode/issues/52675
            if (edit.fileName.match(/[\/\\]node_modules[\/\\]/gi)) {
                continue;
            }
            for (const change of edit.textChanges) {
                if (change.newText.match(/\/node_modules\//gi)) {
                    continue;
                }
            }
            edits.push(await this.fixEdit(edit, isDirectoryRename, oldFile, newFile));
        }
        return typeConverters.WorkspaceEdit.fromFileCodeEdits(this.client, edits);
    }
    async fixEdit(edit, isDirectoryRename, oldFile, newFile) {
        if (!isDirectoryRename || this.client.apiVersion.gte(api_1.default.v300)) {
            return edit;
        }
        const document = await vscode.workspace.openTextDocument(edit.fileName);
        const oldFileRe = new RegExp('/' + regexp_1.escapeRegExp(path.basename(oldFile)) + '/');
        // Workaround for https://github.com/Microsoft/TypeScript/issues/24968
        const textChanges = edit.textChanges.map((change) => {
            const existingText = document.getText(typeConverters.Range.fromTextSpan(change));
            const existingMatch = existingText.match(oldFileRe);
            if (!existingMatch) {
                return change;
            }
            const match = new RegExp('/' + regexp_1.escapeRegExp(path.basename(newFile)) + '/(.+)$', 'g').exec(change.newText);
            if (!match) {
                return change;
            }
            return {
                newText: change.newText.slice(0, -match[1].length),
                start: change.start,
                end: {
                    line: change.end.line,
                    offset: change.end.offset - match[1].length
                }
            };
        });
        return {
            fileName: edit.fileName,
            textChanges
        };
    }
}
exports.UpdateImportsOnFileRenameHandler = UpdateImportsOnFileRenameHandler;
function isTypeScriptDocument(document) {
    return document.languageId === languageIds.typescript || document.languageId === languageIds.typescriptreact;
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\updatePathsOnRename.js.map
