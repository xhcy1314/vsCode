"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const tableOfContentsProvider_1 = require("../tableOfContentsProvider");
const file_1 = require("../util/file");
class OpenDocumentLinkCommand {
    constructor(engine) {
        this.engine = engine;
        this.id = OpenDocumentLinkCommand.id;
    }
    static createCommandUri(path, fragment) {
        return vscode.Uri.parse(`command:${OpenDocumentLinkCommand.id}?${encodeURIComponent(JSON.stringify({ path, fragment }))}`);
    }
    execute(args) {
        const p = decodeURIComponent(args.path);
        return this.tryOpen(p, args).catch(() => {
            if (path.extname(p) === '') {
                return this.tryOpen(p + '.md', args);
            }
            const resource = vscode.Uri.file(p);
            return Promise.resolve(void 0)
                .then(() => vscode.commands.executeCommand('vscode.open', resource))
                .then(() => void 0);
        });
    }
    async tryOpen(path, args) {
        const resource = vscode.Uri.file(path);
        if (vscode.window.activeTextEditor && file_1.isMarkdownFile(vscode.window.activeTextEditor.document) && vscode.window.activeTextEditor.document.uri.fsPath === resource.fsPath) {
            return this.tryRevealLine(vscode.window.activeTextEditor, args.fragment);
        }
        else {
            return vscode.workspace.openTextDocument(resource)
                .then(vscode.window.showTextDocument)
                .then(editor => this.tryRevealLine(editor, args.fragment));
        }
    }
    async tryRevealLine(editor, fragment) {
        if (editor && fragment) {
            const toc = new tableOfContentsProvider_1.TableOfContentsProvider(this.engine, editor.document);
            const entry = await toc.lookup(fragment);
            if (entry) {
                return editor.revealRange(new vscode.Range(entry.line, 0, entry.line, 0), vscode.TextEditorRevealType.AtTop);
            }
            const lineNumberFragment = fragment.match(/^L(\d+)$/i);
            if (lineNumberFragment) {
                const line = +lineNumberFragment[1] - 1;
                if (!isNaN(line)) {
                    return editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.AtTop);
                }
            }
        }
    }
}
OpenDocumentLinkCommand.id = '_markdown.openDocumentLink';
exports.OpenDocumentLinkCommand = OpenDocumentLinkCommand;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/commands\openDocumentLink.js.map
