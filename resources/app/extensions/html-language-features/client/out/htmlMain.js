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
const htmlEmptyTagsShared_1 = require("./htmlEmptyTagsShared");
const tagClosing_1 = require("./tagClosing");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
const vscode_languageserver_protocol_foldingprovider_1 = require("vscode-languageserver-protocol-foldingprovider");
var TagCloseRequest;
(function (TagCloseRequest) {
    TagCloseRequest.type = new vscode_languageclient_1.RequestType('html/tag');
})(TagCloseRequest || (TagCloseRequest = {}));
let telemetryReporter;
function activate(context) {
    let toDispose = context.subscriptions;
    let packageInfo = getPackageInfo(context);
    telemetryReporter = packageInfo && new vscode_extension_telemetry_1.default(packageInfo.name, packageInfo.version, packageInfo.aiKey);
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'htmlServerMain.js'));
    // The debug options for the server
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6045'] };
    // If the extension is launch in debug mode the debug server options are use
    // Otherwise the run options are used
    let serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
    };
    let documentSelector = ['html', 'handlebars', 'razor'];
    let embeddedLanguages = { css: true, javascript: true };
    // Options to control the language client
    let clientOptions = {
        documentSelector,
        synchronize: {
            configurationSection: ['html', 'css', 'javascript'],
        },
        initializationOptions: {
            embeddedLanguages
        }
    };
    // Create the language client and start the client.
    let client = new vscode_languageclient_1.LanguageClient('html', localize(0, null), serverOptions, clientOptions);
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
    toDispose.push(disposable);
    client.onReady().then(() => {
        let tagRequestor = (document, position) => {
            let param = client.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
            return client.sendRequest(TagCloseRequest.type, param);
        };
        disposable = tagClosing_1.activateTagClosing(tagRequestor, { html: true, handlebars: true, razor: true }, 'html.autoClosingTags');
        toDispose.push(disposable);
        disposable = client.onTelemetry(e => {
            if (telemetryReporter) {
                telemetryReporter.sendTelemetryEvent(e.key, e.data);
            }
        });
        toDispose.push(disposable);
        toDispose.push(initFoldingProvider());
    });
    vscode_1.languages.setLanguageConfiguration('html', {
        indentationRules: {
            increaseIndentPattern: /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
            decreaseIndentPattern: /^\s*(<\/(?!html)[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/
        },
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
        onEnterRules: [
            {
                beforeText: new RegExp(`<(?!(?:${htmlEmptyTagsShared_1.EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
                afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
                action: { indentAction: vscode_1.IndentAction.IndentOutdent }
            },
            {
                beforeText: new RegExp(`<(?!(?:${htmlEmptyTagsShared_1.EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
                action: { indentAction: vscode_1.IndentAction.Indent }
            }
        ],
    });
    vscode_1.languages.setLanguageConfiguration('handlebars', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
        onEnterRules: [
            {
                beforeText: new RegExp(`<(?!(?:${htmlEmptyTagsShared_1.EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
                afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
                action: { indentAction: vscode_1.IndentAction.IndentOutdent }
            },
            {
                beforeText: new RegExp(`<(?!(?:${htmlEmptyTagsShared_1.EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
                action: { indentAction: vscode_1.IndentAction.Indent }
            }
        ],
    });
    vscode_1.languages.setLanguageConfiguration('razor', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
        onEnterRules: [
            {
                beforeText: new RegExp(`<(?!(?:${htmlEmptyTagsShared_1.EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
                afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
                action: { indentAction: vscode_1.IndentAction.IndentOutdent }
            },
            {
                beforeText: new RegExp(`<(?!(?:${htmlEmptyTagsShared_1.EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
                action: { indentAction: vscode_1.IndentAction.Indent }
            }
        ],
    });
    const regionCompletionRegExpr = /^(\s*)(<(!(-(-\s*(#\w*)?)?)?)?)?$/;
    vscode_1.languages.registerCompletionItemProvider(documentSelector, {
        provideCompletionItems(doc, pos) {
            let lineUntilPos = doc.getText(new vscode_1.Range(new vscode_1.Position(pos.line, 0), pos));
            let match = lineUntilPos.match(regionCompletionRegExpr);
            if (match) {
                let range = new vscode_1.Range(new vscode_1.Position(pos.line, match[1].length), pos);
                let beginProposal = new vscode_1.CompletionItem('#region', vscode_1.CompletionItemKind.Snippet);
                beginProposal.range = range;
                beginProposal.insertText = new vscode_1.SnippetString('<!-- #region $1-->');
                beginProposal.documentation = localize(1, null);
                beginProposal.filterText = match[2];
                beginProposal.sortText = 'za';
                let endProposal = new vscode_1.CompletionItem('#endregion', vscode_1.CompletionItemKind.Snippet);
                endProposal.range = range;
                endProposal.insertText = new vscode_1.SnippetString('<!-- #endregion -->');
                endProposal.documentation = localize(2, null);
                endProposal.filterText = match[2];
                endProposal.sortText = 'zb';
                return [beginProposal, endProposal];
            }
            return null;
        }
    });
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
        return vscode_1.languages.registerFoldingRangeProvider('html', {
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
}
exports.activate = activate;
function getPackageInfo(context) {
    let extensionPackage = require(context.asAbsolutePath('./package.json'));
    if (extensionPackage) {
        return {
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey
        };
    }
    return null;
}
function deactivate() {
    return telemetryReporter ? telemetryReporter.dispose() : Promise.resolve(null);
}
exports.deactivate = deactivate;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\html-language-features\client\out/htmlMain.js.map
