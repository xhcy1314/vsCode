"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const nls = require("vscode-nls");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const typeConverters = require("../utils/typeConverters");
const localize = nls.loadMessageBundle(__filename);
class JsDocCompletionItem extends vscode_1.CompletionItem {
    constructor(document, position) {
        super('/** */', vscode_1.CompletionItemKind.Snippet);
        this.detail = localize(0, null);
        this.insertText = '';
        this.sortText = '\0';
        const line = document.lineAt(position.line).text;
        const prefix = line.slice(0, position.character).match(/\/\**\s*$/);
        const suffix = line.slice(position.character).match(/^\s*\**\//);
        const start = position.translate(0, prefix ? -prefix[0].length : 0);
        this.range = new vscode_1.Range(start, position.translate(0, suffix ? suffix[0].length : 0));
        this.command = {
            title: 'Try Complete JSDoc',
            command: TryCompleteJsDocCommand.COMMAND_NAME,
            arguments: [document.uri, start]
        };
    }
}
class JsDocCompletionProvider {
    constructor(client, commandManager) {
        this.client = client;
        commandManager.register(new TryCompleteJsDocCommand(client));
    }
    async provideCompletionItems(document, position, token) {
        const file = this.client.toPath(document.uri);
        if (!file) {
            return [];
        }
        if (!this.isValidCursorPosition(document, position)) {
            return [];
        }
        if (!await this.isCommentableLocation(file, position, token)) {
            return [];
        }
        return [new JsDocCompletionItem(document, position)];
    }
    async isCommentableLocation(file, position, token) {
        const args = {
            file
        };
        const response = await Promise.race([
            this.client.execute('navtree', args, token),
            new Promise((resolve) => setTimeout(resolve, 250))
        ]);
        if (!response || !response.body) {
            return false;
        }
        const body = response.body;
        function matchesPosition(tree) {
            if (!tree.spans.length) {
                return false;
            }
            const span = typeConverters.Range.fromTextSpan(tree.spans[0]);
            if (position.line === span.start.line - 1 || position.line === span.start.line) {
                return true;
            }
            return tree.childItems ? tree.childItems.some(matchesPosition) : false;
        }
        return matchesPosition(body);
    }
    isValidCursorPosition(document, position) {
        // Only show the JSdoc completion when the everything before the cursor is whitespace
        // or could be the opening of a comment
        const line = document.lineAt(position.line).text;
        const prefix = line.slice(0, position.character);
        return prefix.match(/^\s*$|\/\*\*\s*$|^\s*\/\*\*+\s*$/) !== null;
    }
    resolveCompletionItem(item, _token) {
        return item;
    }
}
class TryCompleteJsDocCommand {
    constructor(client) {
        this.client = client;
        this.id = TryCompleteJsDocCommand.COMMAND_NAME;
    }
    /**
     * Try to insert a jsdoc comment, using a template provide by typescript
     * if possible, otherwise falling back to a default comment format.
     */
    async execute(resource, start) {
        const file = this.client.toPath(resource);
        if (!file) {
            return false;
        }
        const editor = vscode_1.window.activeTextEditor;
        if (!editor || editor.document.uri.fsPath !== resource.fsPath) {
            return false;
        }
        const didInsertFromTemplate = await this.tryInsertJsDocFromTemplate(editor, file, start);
        if (didInsertFromTemplate) {
            return true;
        }
        return this.tryInsertDefaultDoc(editor, start);
    }
    async tryInsertJsDocFromTemplate(editor, file, position) {
        const snippet = await TryCompleteJsDocCommand.getSnippetTemplate(this.client, file, position);
        if (!snippet) {
            return false;
        }
        return editor.insertSnippet(snippet, position, { undoStopBefore: false, undoStopAfter: true });
    }
    static getSnippetTemplate(client, file, position) {
        const args = typeConverters.Position.toFileLocationRequestArgs(file, position);
        return Promise.race([
            client.execute('docCommentTemplate', args),
            new Promise((_, reject) => setTimeout(reject, 250))
        ]).then((res) => {
            if (!res || !res.body) {
                return undefined;
            }
            // Workaround for #43619
            // docCommentTemplate previously returned undefined for empty jsdoc templates.
            // TS 2.7 now returns a single line doc comment, which breaks indentation.
            if (res.body.newText === '/** */') {
                return undefined;
            }
            return templateToSnippet(res.body.newText);
        }, () => undefined);
    }
    /**
     * Insert the default JSDoc
     */
    tryInsertDefaultDoc(editor, position) {
        const snippet = new vscode_1.SnippetString(`/**\n * $0\n */`);
        return editor.insertSnippet(snippet, position, { undoStopBefore: false, undoStopAfter: true });
    }
}
TryCompleteJsDocCommand.COMMAND_NAME = '_typeScript.tryCompleteJsDoc';
function templateToSnippet(template) {
    // TODO: use append placeholder
    let snippetIndex = 1;
    template = template.replace(/\$/g, '\\$');
    template = template.replace(/^\s*(?=(\/|[ ]\*))/gm, '');
    template = template.replace(/^(\/\*\*\s*\*[ ]*)$/m, (x) => x + `\$0`);
    template = template.replace(/\* @param([ ]\{\S+\})?\s+(\S+)\s*$/gm, (_param, type, post) => {
        let out = '* @param ';
        if (type === ' {any}' || type === ' {*}') {
            out += `{\$\{${snippetIndex++}:*\}} `;
        }
        else if (type) {
            out += type + ' ';
        }
        out += post + ` \${${snippetIndex++}}`;
        return out;
    });
    return new vscode_1.SnippetString(template);
}
exports.templateToSnippet = templateToSnippet;
function register(selector, client, commandManager) {
    return new dependentRegistration_1.ConfigurationDependentRegistration('jsDocCompletion', 'enabled', () => {
        return vscode_1.languages.registerCompletionItemProvider(selector, new JsDocCompletionProvider(client, commandManager), '*');
    });
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\jsDocCompletions.js.map
