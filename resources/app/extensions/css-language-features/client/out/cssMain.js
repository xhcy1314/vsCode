/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const vscode_languageserver_protocol_foldingprovider_1 = require("vscode-languageserver-protocol-foldingprovider");
// this method is called when vs code is activated
function activate(context) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'cssServerMain.js'));
    // The debug options for the server
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6044'] };
    // If the extension is launch in debug mode the debug server options are use
    // Otherwise the run options are used
    let serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
    };
    let documentSelector = ['css', 'scss', 'less'];
    // Options to control the language client
    let clientOptions = {
        documentSelector,
        synchronize: {
            configurationSection: ['css', 'scss', 'less']
        },
        initializationOptions: {}
    };
    // Create the language client and start the client.
    let client = new vscode_languageclient_1.LanguageClient('css', localize(0, null), serverOptions, clientOptions);
    client.registerProposedFeatures();
    client.registerFeature({
        fillClientCapabilities(capabilities) {
            let textDocumentCap = capabilities.textDocument;
            if (!textDocumentCap) {
                textDocumentCap = capabilities.textDocument = {};
            }
            textDocumentCap.foldingRange = {
                dynamicRegistration: false,
                rangeLimit: 5000,
                lineFoldingOnly: true
            };
        },
        initialize(capabilities, documentSelector) {
        }
    });
    let disposable = client.start();
    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);
    let indentationRules = {
        increaseIndentPattern: /(^.*\{[^}]*$)/,
        decreaseIndentPattern: /^\s*\}/
    };
    vscode_1.languages.setLanguageConfiguration('css', {
        wordPattern: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
        indentationRules: indentationRules
    });
    vscode_1.languages.setLanguageConfiguration('less', {
        wordPattern: /(#?-?\d*\.\d\w*%?)|(::?[\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
        indentationRules: indentationRules
    });
    vscode_1.languages.setLanguageConfiguration('scss', {
        wordPattern: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g,
        indentationRules: indentationRules
    });
    client.onReady().then(() => {
        context.subscriptions.push(initCompletionProvider());
        context.subscriptions.push(initFoldingProvider());
    });
    function initCompletionProvider() {
        const regionCompletionRegExpr = /^(\s*)(\/(\*\s*(#\w*)?)?)?$/;
        return vscode_1.languages.registerCompletionItemProvider(documentSelector, {
            provideCompletionItems(doc, pos) {
                let lineUntilPos = doc.getText(new vscode_1.Range(new vscode_1.Position(pos.line, 0), pos));
                let match = lineUntilPos.match(regionCompletionRegExpr);
                if (match) {
                    let range = new vscode_1.Range(new vscode_1.Position(pos.line, match[1].length), pos);
                    let beginProposal = new vscode_1.CompletionItem('#region', vscode_1.CompletionItemKind.Snippet);
                    beginProposal.range = range;
                    vscode_1.TextEdit.replace(range, '/* #region */');
                    beginProposal.insertText = new vscode_1.SnippetString('/* #region $1*/');
                    beginProposal.documentation = localize(1, null);
                    beginProposal.filterText = match[2];
                    beginProposal.sortText = 'za';
                    let endProposal = new vscode_1.CompletionItem('#endregion', vscode_1.CompletionItemKind.Snippet);
                    endProposal.range = range;
                    endProposal.insertText = '/* #endregion */';
                    endProposal.documentation = localize(2, null);
                    endProposal.sortText = 'zb';
                    endProposal.filterText = match[2];
                    return [beginProposal, endProposal];
                }
                return null;
            }
        });
    }
    function initFoldingProvider() {
        function getKind(kind) {
            if (kind) {
                switch (kind) {
                    case vscode_languageserver_protocol_foldingprovider_1.FoldingRangeKind.Comment:
                        return vscode_1.FoldingRangeKind.Comment;
                    case vscode_languageserver_protocol_foldingprovider_1.FoldingRangeKind.Imports:
                        return vscode_1.FoldingRangeKind.Imports;
                    case vscode_languageserver_protocol_foldingprovider_1.FoldingRangeKind.Region:
                        return vscode_1.FoldingRangeKind.Region;
                }
            }
            return void 0;
        }
        return vscode_1.languages.registerFoldingRangeProvider(documentSelector, {
            provideFoldingRanges(document, context, token) {
                const param = {
                    textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document)
                };
                return client.sendRequest(vscode_languageserver_protocol_foldingprovider_1.FoldingRangeRequest.type, param, token).then(ranges => {
                    if (Array.isArray(ranges)) {
                        return ranges.map(r => new vscode_1.FoldingRange(r.startLine, r.endLine, getKind(r.kind)));
                    }
                    return null;
                }, error => {
                    client.logFailedRequest(vscode_languageserver_protocol_foldingprovider_1.FoldingRangeRequest.type, error);
                    return null;
                });
            }
        });
    }
    vscode_1.commands.registerCommand('_css.applyCodeAction', applyCodeAction);
    function applyCodeAction(uri, documentVersion, edits) {
        let textEditor = vscode_1.window.activeTextEditor;
        if (textEditor && textEditor.document.uri.toString() === uri) {
            if (textEditor.document.version !== documentVersion) {
                vscode_1.window.showInformationMessage(`CSS fix is outdated and can't be applied to the document.`);
            }
            textEditor.edit(mutator => {
                for (let edit of edits) {
                    mutator.replace(client.protocol2CodeConverter.asRange(edit.range), edit.newText);
                }
            }).then(success => {
                if (!success) {
                    vscode_1.window.showErrorMessage('Failed to apply CSS fix to the document. Please consider opening an issue with steps to reproduce.');
                }
            });
        }
    }
}
exports.activate = activate;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\css-language-features\client\out/cssMain.js.map
