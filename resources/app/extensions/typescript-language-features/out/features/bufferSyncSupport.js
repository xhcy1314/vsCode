"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const vscode_1 = require("vscode");
const api_1 = require("../utils/api");
const async_1 = require("../utils/async");
const dispose_1 = require("../utils/dispose");
const languageModeIds = require("../utils/languageModeIds");
const resourceMap_1 = require("./resourceMap");
var BufferKind;
(function (BufferKind) {
    BufferKind[BufferKind["TypeScript"] = 1] = "TypeScript";
    BufferKind[BufferKind["JavaScript"] = 2] = "JavaScript";
})(BufferKind || (BufferKind = {}));
function mode2ScriptKind(mode) {
    switch (mode) {
        case languageModeIds.typescript: return 'TS';
        case languageModeIds.typescriptreact: return 'TSX';
        case languageModeIds.javascript: return 'JS';
        case languageModeIds.javascriptreact: return 'JSX';
    }
    return undefined;
}
class SyncedBuffer {
    constructor(document, filepath, diagnosticRequestor, client) {
        this.document = document;
        this.filepath = filepath;
        this.diagnosticRequestor = diagnosticRequestor;
        this.client = client;
    }
    open() {
        const args = {
            file: this.filepath,
            fileContent: this.document.getText(),
        };
        if (this.client.apiVersion.gte(api_1.default.v203)) {
            const scriptKind = mode2ScriptKind(this.document.languageId);
            if (scriptKind) {
                args.scriptKindName = scriptKind;
            }
        }
        if (this.client.apiVersion.gte(api_1.default.v230)) {
            args.projectRootPath = this.client.getWorkspaceRootForResource(this.document.uri);
        }
        if (this.client.apiVersion.gte(api_1.default.v240)) {
            const tsPluginsForDocument = this.client.plugins
                .filter(x => x.languages.indexOf(this.document.languageId) >= 0);
            if (tsPluginsForDocument.length) {
                args.plugins = tsPluginsForDocument.map(plugin => plugin.name);
            }
        }
        this.client.execute('open', args, false);
    }
    get resource() {
        return this.document.uri;
    }
    get lineCount() {
        return this.document.lineCount;
    }
    get kind() {
        switch (this.document.languageId) {
            case languageModeIds.javascript:
            case languageModeIds.javascriptreact:
                return BufferKind.JavaScript;
            case languageModeIds.typescript:
            case languageModeIds.typescriptreact:
            default:
                return BufferKind.TypeScript;
        }
    }
    close() {
        const args = {
            file: this.filepath
        };
        this.client.execute('close', args, false);
    }
    onContentChanged(events) {
        for (const { range, text } of events) {
            const args = {
                file: this.filepath,
                line: range.start.line + 1,
                offset: range.start.character + 1,
                endLine: range.end.line + 1,
                endOffset: range.end.character + 1,
                insertString: text
            };
            this.client.execute('change', args, false);
        }
        this.diagnosticRequestor.requestDiagnostic(this.document.uri);
    }
}
class SyncedBufferMap extends resourceMap_1.ResourceMap {
    getForPath(filePath) {
        return this.get(vscode_1.Uri.file(filePath));
    }
    get allBuffers() {
        return this.values;
    }
    get allResources() {
        return this.keys;
    }
}
class BufferSyncSupport {
    constructor(client, modeIds) {
        this._validateJavaScript = true;
        this._validateTypeScript = true;
        this.disposables = [];
        this.pendingDiagnostics = new Map();
        this.listening = false;
        this._onDelete = new vscode_1.EventEmitter();
        this.onDelete = this._onDelete.event;
        this.client = client;
        this.modeIds = new Set(modeIds);
        this.diagnosticDelayer = new async_1.Delayer(300);
        this.syncedBuffers = new SyncedBufferMap(path => this.normalizePath(path));
        this.updateConfiguration();
        vscode_1.workspace.onDidChangeConfiguration(() => this.updateConfiguration(), null);
    }
    listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        vscode_1.workspace.onDidOpenTextDocument(this.openTextDocument, this, this.disposables);
        vscode_1.workspace.onDidCloseTextDocument(this.onDidCloseTextDocument, this, this.disposables);
        vscode_1.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this.disposables);
        vscode_1.workspace.textDocuments.forEach(this.openTextDocument, this);
    }
    handles(resource) {
        return this.syncedBuffers.has(resource);
    }
    toResource(filePath) {
        const buffer = this.syncedBuffers.getForPath(filePath);
        if (buffer) {
            return buffer.resource;
        }
        return vscode_1.Uri.file(filePath);
    }
    reOpenDocuments() {
        for (const buffer of this.syncedBuffers.allBuffers) {
            buffer.open();
        }
    }
    dispose() {
        dispose_1.disposeAll(this.disposables);
        this._onDelete.dispose();
    }
    openTextDocument(document) {
        if (!this.modeIds.has(document.languageId)) {
            return;
        }
        const resource = document.uri;
        const filepath = this.client.normalizedPath(resource);
        if (!filepath) {
            return;
        }
        if (this.syncedBuffers.has(resource)) {
            return;
        }
        const syncedBuffer = new SyncedBuffer(document, filepath, this, this.client);
        this.syncedBuffers.set(resource, syncedBuffer);
        syncedBuffer.open();
        this.requestDiagnostic(resource);
    }
    closeResource(resource) {
        const syncedBuffer = this.syncedBuffers.get(resource);
        if (!syncedBuffer) {
            return;
        }
        this.syncedBuffers.delete(resource);
        syncedBuffer.close();
        if (!fs.existsSync(resource.fsPath)) {
            this._onDelete.fire(resource);
            this.requestAllDiagnostics();
        }
    }
    onDidCloseTextDocument(document) {
        this.closeResource(document.uri);
    }
    onDidChangeTextDocument(e) {
        const syncedBuffer = this.syncedBuffers.get(e.document.uri);
        if (!syncedBuffer) {
            return;
        }
        syncedBuffer.onContentChanged(e.contentChanges);
        if (this.pendingGetErr) {
            this.pendingGetErr.token.cancel();
            this.pendingGetErr = undefined;
            this.diagnosticDelayer.trigger(() => {
                this.sendPendingDiagnostics();
            }, 200);
        }
    }
    requestAllDiagnostics() {
        for (const buffer of this.syncedBuffers.allBuffers) {
            if (this.shouldValidate(buffer)) {
                this.pendingDiagnostics.set(buffer.filepath, Date.now());
            }
        }
        this.diagnosticDelayer.trigger(() => {
            this.sendPendingDiagnostics();
        }, 200);
    }
    getErr(resources) {
        const handledResources = resources.filter(resource => this.handles(resource));
        if (!handledResources.length) {
            return;
        }
        for (const resource of handledResources) {
            const file = this.client.normalizedPath(resource);
            if (file) {
                this.pendingDiagnostics.set(file, Date.now());
            }
        }
        this.diagnosticDelayer.trigger(() => {
            this.sendPendingDiagnostics();
        }, 200);
    }
    requestDiagnostic(resource) {
        const file = this.client.normalizedPath(resource);
        if (!file) {
            return;
        }
        this.pendingDiagnostics.set(file, Date.now());
        const buffer = this.syncedBuffers.get(resource);
        if (!buffer || !this.shouldValidate(buffer)) {
            return;
        }
        let delay = 300;
        const lineCount = buffer.lineCount;
        delay = Math.min(Math.max(Math.ceil(lineCount / 20), 300), 800);
        this.diagnosticDelayer.trigger(() => {
            this.sendPendingDiagnostics();
        }, delay);
    }
    hasPendingDiagnostics(resource) {
        const file = this.client.normalizedPath(resource);
        return !file || this.pendingDiagnostics.has(file);
    }
    sendPendingDiagnostics() {
        const files = new Set(Array.from(this.pendingDiagnostics.entries())
            .sort((a, b) => a[1] - b[1])
            .map(entry => entry[0]));
        // Add all open TS buffers to the geterr request. They might be visible
        for (const file of this.syncedBuffers.allResources) {
            if (!this.pendingDiagnostics.get(file)) {
                files.add(file);
            }
        }
        if (this.pendingGetErr) {
            for (const file of this.pendingGetErr.files) {
                files.add(file);
            }
        }
        if (files.size) {
            const fileList = Array.from(files);
            const args = {
                delay: 0,
                files: fileList
            };
            const token = new vscode_1.CancellationTokenSource();
            const getErr = this.pendingGetErr = {
                request: this.client.executeAsync('geterr', args, token.token)
                    .then(undefined, () => { })
                    .then(() => {
                    if (this.pendingGetErr === getErr) {
                        this.pendingGetErr = undefined;
                    }
                }),
                files: fileList,
                token
            };
        }
        this.pendingDiagnostics.clear();
    }
    updateConfiguration() {
        const jsConfig = vscode_1.workspace.getConfiguration('javascript', null);
        const tsConfig = vscode_1.workspace.getConfiguration('typescript', null);
        this._validateJavaScript = jsConfig.get('validate.enable', true);
        this._validateTypeScript = tsConfig.get('validate.enable', true);
    }
    shouldValidate(buffer) {
        switch (buffer.kind) {
            case BufferKind.JavaScript:
                return this._validateJavaScript;
            case BufferKind.TypeScript:
            default:
                return this._validateTypeScript;
        }
    }
    normalizePath(path) {
        return this.client.normalizedPath(path);
    }
}
exports.default = BufferSyncSupport;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\bufferSyncSupport.js.map
