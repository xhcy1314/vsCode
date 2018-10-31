"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const dispose_1 = require("../util/dispose");
const nls = require("vscode-nls");
const topmostLineMonitor_1 = require("../util/topmostLineMonitor");
const file_1 = require("../util/file");
const localize = nls.loadMessageBundle(__filename);
class MarkdownPreview {
    constructor(webview, resource, locked, _contentProvider, _previewConfigurations, _logger, topmostLineMonitor, _contributions) {
        this._contentProvider = _contentProvider;
        this._previewConfigurations = _previewConfigurations;
        this._logger = _logger;
        this._contributions = _contributions;
        this.line = undefined;
        this.disposables = [];
        this.firstUpdate = true;
        this.forceUpdate = false;
        this.isScrolling = false;
        this._disposed = false;
        this._onDisposeEmitter = new vscode.EventEmitter();
        this.onDispose = this._onDisposeEmitter.event;
        this._onDidChangeViewStateEmitter = new vscode.EventEmitter();
        this.onDidChangeViewState = this._onDidChangeViewStateEmitter.event;
        this._resource = resource;
        this._locked = locked;
        this.editor = webview;
        this.editor.onDidDispose(() => {
            this.dispose();
        }, null, this.disposables);
        this.editor.onDidChangeViewState(e => {
            this._onDidChangeViewStateEmitter.fire(e);
        }, null, this.disposables);
        this.editor.webview.onDidReceiveMessage(e => {
            if (e.source !== this._resource.toString()) {
                return;
            }
            switch (e.type) {
                case 'command':
                    vscode.commands.executeCommand(e.body.command, ...e.body.args);
                    break;
                case 'revealLine':
                    this.onDidScrollPreview(e.body.line);
                    break;
                case 'didClick':
                    this.onDidClickPreview(e.body.line);
                    break;
            }
        }, null, this.disposables);
        vscode.workspace.onDidChangeTextDocument(event => {
            if (this.isPreviewOf(event.document.uri)) {
                this.refresh();
            }
        }, null, this.disposables);
        topmostLineMonitor.onDidChangeTopmostLine(event => {
            if (this.isPreviewOf(event.resource)) {
                this.updateForView(event.resource, event.line);
            }
        }, null, this.disposables);
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (this.isPreviewOf(event.textEditor.document.uri)) {
                this.postMessage({
                    type: 'onDidChangeTextEditorSelection',
                    line: event.selections[0].active.line,
                    source: this.resource.toString()
                });
            }
        }, null, this.disposables);
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && file_1.isMarkdownFile(editor.document) && !this._locked) {
                this.update(editor.document.uri);
            }
        }, null, this.disposables);
    }
    static async revive(webview, state, contentProvider, previewConfigurations, logger, topmostLineMonitor, contributions) {
        const resource = vscode.Uri.parse(state.resource);
        const locked = state.locked;
        const line = state.line;
        const preview = new MarkdownPreview(webview, resource, locked, contentProvider, previewConfigurations, logger, topmostLineMonitor, contributions);
        preview.editor.webview.options = MarkdownPreview.getWebviewOptions(resource, contributions);
        if (!isNaN(line)) {
            preview.line = line;
        }
        await preview.doUpdate();
        return preview;
    }
    static create(resource, previewColumn, locked, contentProvider, previewConfigurations, logger, topmostLineMonitor, contributions) {
        const webview = vscode.window.createWebviewPanel(MarkdownPreview.viewType, MarkdownPreview.getPreviewTitle(resource, locked), previewColumn, Object.assign({ enableFindWidget: true }, MarkdownPreview.getWebviewOptions(resource, contributions)));
        return new MarkdownPreview(webview, resource, locked, contentProvider, previewConfigurations, logger, topmostLineMonitor, contributions);
    }
    get resource() {
        return this._resource;
    }
    get state() {
        return {
            resource: this.resource.toString(),
            locked: this._locked,
            line: this.line
        };
    }
    dispose() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._onDisposeEmitter.fire();
        this._onDisposeEmitter.dispose();
        this._onDidChangeViewStateEmitter.dispose();
        this.editor.dispose();
        dispose_1.disposeAll(this.disposables);
    }
    update(resource) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === resource.fsPath) {
            this.line = topmostLineMonitor_1.getVisibleLine(editor);
        }
        // If we have changed resources, cancel any pending updates
        const isResourceChange = resource.fsPath !== this._resource.fsPath;
        if (isResourceChange) {
            clearTimeout(this.throttleTimer);
            this.throttleTimer = undefined;
        }
        this._resource = resource;
        // Schedule update if none is pending
        if (!this.throttleTimer) {
            if (isResourceChange || this.firstUpdate) {
                this.doUpdate();
            }
            else {
                this.throttleTimer = setTimeout(() => this.doUpdate(), 300);
            }
        }
        this.firstUpdate = false;
    }
    refresh() {
        this.forceUpdate = true;
        this.update(this._resource);
    }
    updateConfiguration() {
        if (this._previewConfigurations.hasConfigurationChanged(this._resource)) {
            this.refresh();
        }
    }
    get position() {
        return this.editor.viewColumn;
    }
    matchesResource(otherResource, otherPosition, otherLocked) {
        if (this.position !== otherPosition) {
            return false;
        }
        if (this._locked) {
            return otherLocked && this.isPreviewOf(otherResource);
        }
        else {
            return !otherLocked;
        }
    }
    matches(otherPreview) {
        return this.matchesResource(otherPreview._resource, otherPreview.position, otherPreview._locked);
    }
    reveal(viewColumn) {
        this.editor.reveal(viewColumn);
    }
    toggleLock() {
        this._locked = !this._locked;
        this.editor.title = MarkdownPreview.getPreviewTitle(this._resource, this._locked);
    }
    isPreviewOf(resource) {
        return this._resource.fsPath === resource.fsPath;
    }
    static getPreviewTitle(resource, locked) {
        return locked
            ? localize(0, null, path.basename(resource.fsPath))
            : localize(1, null, path.basename(resource.fsPath));
    }
    updateForView(resource, topLine) {
        if (!this.isPreviewOf(resource)) {
            return;
        }
        if (this.isScrolling) {
            this.isScrolling = false;
            return;
        }
        if (typeof topLine === 'number') {
            this._logger.log('updateForView', { markdownFile: resource });
            this.line = topLine;
            this.postMessage({
                type: 'updateView',
                line: topLine,
                source: resource.toString()
            });
        }
    }
    postMessage(msg) {
        if (!this._disposed) {
            this.editor.webview.postMessage(msg);
        }
    }
    async doUpdate() {
        const resource = this._resource;
        clearTimeout(this.throttleTimer);
        this.throttleTimer = undefined;
        const document = await vscode.workspace.openTextDocument(resource);
        if (!this.forceUpdate && this.currentVersion && this.currentVersion.resource.fsPath === resource.fsPath && this.currentVersion.version === document.version) {
            if (this.line) {
                this.updateForView(resource, this.line);
            }
            return;
        }
        this.forceUpdate = false;
        this.currentVersion = { resource, version: document.version };
        const content = await this._contentProvider.provideTextDocumentContent(document, this._previewConfigurations, this.line, this.state);
        if (this._resource === resource) {
            this.editor.title = MarkdownPreview.getPreviewTitle(this._resource, this._locked);
            this.editor.webview.options = MarkdownPreview.getWebviewOptions(resource, this._contributions);
            this.editor.webview.html = content;
        }
    }
    static getWebviewOptions(resource, contributions) {
        return {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: MarkdownPreview.getLocalResourceRoots(resource, contributions)
        };
    }
    static getLocalResourceRoots(resource, contributions) {
        const baseRoots = contributions.previewResourceRoots;
        const folder = vscode.workspace.getWorkspaceFolder(resource);
        if (folder) {
            return baseRoots.concat(folder.uri);
        }
        if (!resource.scheme || resource.scheme === 'file') {
            return baseRoots.concat(vscode.Uri.file(path.dirname(resource.fsPath)));
        }
        return baseRoots;
    }
    onDidScrollPreview(line) {
        this.line = line;
        for (const editor of vscode.window.visibleTextEditors) {
            if (!this.isPreviewOf(editor.document.uri)) {
                continue;
            }
            this.isScrolling = true;
            const sourceLine = Math.floor(line);
            const fraction = line - sourceLine;
            const text = editor.document.lineAt(sourceLine).text;
            const start = Math.floor(fraction * text.length);
            editor.revealRange(new vscode.Range(sourceLine, start, sourceLine + 1, 0), vscode.TextEditorRevealType.AtTop);
        }
    }
    async onDidClickPreview(line) {
        for (const visibleEditor of vscode.window.visibleTextEditors) {
            if (this.isPreviewOf(visibleEditor.document.uri)) {
                const editor = await vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn);
                const position = new vscode.Position(line, 0);
                editor.selection = new vscode.Selection(position, position);
                return;
            }
        }
        vscode.workspace.openTextDocument(this._resource).then(vscode.window.showTextDocument);
    }
}
MarkdownPreview.viewType = 'markdown.preview';
exports.MarkdownPreview = MarkdownPreview;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/features\preview.js.map
