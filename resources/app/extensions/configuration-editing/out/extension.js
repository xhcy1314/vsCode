/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var nls = require("vscode-nls");
var localize = nls.loadMessageBundle(__filename);
var vscode = require("vscode");
var jsonc_parser_1 = require("jsonc-parser");
var path = require("path");
var settingsDocumentHelper_1 = require("./settingsDocumentHelper");
var decoration = vscode.window.createTextEditorDecorationType({
    color: '#9e9e9e'
});
var pendingLaunchJsonDecoration;
function activate(context) {
    var _a;
    //keybindings.json command-suggestions
    context.subscriptions.push(registerKeybindingsCompletions());
    //settings.json suggestions
    context.subscriptions.push(registerSettingsCompletions());
    //extensions suggestions
    (_a = context.subscriptions).push.apply(_a, registerExtensionsCompletions());
    // launch.json variable suggestions
    context.subscriptions.push(registerVariableCompletions('**/launch.json'));
    // task.json variable suggestions
    context.subscriptions.push(registerVariableCompletions('**/tasks.json'));
    // launch.json decorations
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(function (editor) { return updateLaunchJsonDecorations(editor); }, null, context.subscriptions));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(function (event) {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            if (pendingLaunchJsonDecoration) {
                clearTimeout(pendingLaunchJsonDecoration);
            }
            pendingLaunchJsonDecoration = setTimeout(function () { return updateLaunchJsonDecorations(vscode.window.activeTextEditor); }, 1000);
        }
    }, null, context.subscriptions));
    updateLaunchJsonDecorations(vscode.window.activeTextEditor);
    context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(function (e) {
        if (!e.document.fileName.endsWith('/settings.json')) {
            return;
        }
        autoFixSettingsJSON(e);
    }));
}
exports.activate = activate;
function autoFixSettingsJSON(willSaveEvent) {
    var document = willSaveEvent.document;
    var text = document.getText();
    var edit = new vscode.WorkspaceEdit();
    var lastEndOfSomething = -1;
    jsonc_parser_1.visit(text, {
        onArrayEnd: function (offset, length) {
            lastEndOfSomething = offset + length;
        },
        onLiteralValue: function (value, offset, length) {
            lastEndOfSomething = offset + length;
        },
        onObjectEnd: function (offset, length) {
            lastEndOfSomething = offset + length;
        },
        onError: function (error, offset, length) {
            if (error === jsonc_parser_1.ParseErrorCode.CommaExpected && lastEndOfSomething > -1) {
                var fixPosition = document.positionAt(lastEndOfSomething);
                // Don't insert a comma immediately before a : or ' :'
                var colonRange = document.getWordRangeAtPosition(fixPosition, / *:/);
                if (!colonRange) {
                    edit.insert(document.uri, fixPosition, ',');
                }
            }
        }
    });
    willSaveEvent.waitUntil(vscode.workspace.applyEdit(edit));
}
function registerKeybindingsCompletions() {
    var commands = vscode.commands.getCommands(true);
    return vscode.languages.registerCompletionItemProvider({ pattern: '**/keybindings.json' }, {
        provideCompletionItems: function (document, position, token) {
            var location = jsonc_parser_1.getLocation(document.getText(), document.offsetAt(position));
            if (location.path[1] === 'command') {
                var range_1 = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
                return commands.then(function (ids) { return ids.map(function (id) { return newSimpleCompletionItem(JSON.stringify(id), range_1); }); });
            }
        }
    });
}
function registerSettingsCompletions() {
    return vscode.languages.registerCompletionItemProvider({ language: 'jsonc', pattern: '**/settings.json' }, {
        provideCompletionItems: function (document, position, token) {
            return new settingsDocumentHelper_1.SettingsDocument(document).provideCompletionItems(position, token);
        }
    });
}
function registerVariableCompletions(pattern) {
    return vscode.languages.registerCompletionItemProvider({ language: 'jsonc', pattern: pattern }, {
        provideCompletionItems: function (document, position, token) {
            var location = jsonc_parser_1.getLocation(document.getText(), document.offsetAt(position));
            if (!location.isAtPropertyKey && location.previousNode && location.previousNode.type === 'string') {
                var indexOf$ = document.lineAt(position.line).text.indexOf('$');
                var startPosition_1 = indexOf$ >= 0 ? new vscode.Position(position.line, indexOf$) : position;
                return [{ label: 'workspaceFolder', detail: localize(0, null) }, { label: 'workspaceFolderBasename', detail: localize(1, null) },
                    { label: 'relativeFile', detail: localize(2, null) }, { label: 'file', detail: localize(3, null) }, { label: 'cwd', detail: localize(4, null) },
                    { label: 'lineNumber', detail: localize(5, null) }, { label: 'selectedText', detail: localize(6, null) },
                    { label: 'fileDirname', detail: localize(7, null) }, { label: 'fileExtname', detail: localize(8, null) }, { label: 'fileBasename', detail: localize(9, null) },
                    { label: 'fileBasenameNoExtension', detail: localize(10, null) }].map(function (variable) { return ({
                    label: '${' + variable.label + '}',
                    range: new vscode.Range(startPosition_1, position),
                    detail: variable.detail
                }); });
            }
            return [];
        }
    });
}
function registerExtensionsCompletions() {
    return [registerExtensionsCompletionsInExtensionsDocument(), registerExtensionsCompletionsInWorkspaceConfigurationDocument()];
}
function registerExtensionsCompletionsInExtensionsDocument() {
    return vscode.languages.registerCompletionItemProvider({ pattern: '**/extensions.json' }, {
        provideCompletionItems: function (document, position, token) {
            var location = jsonc_parser_1.getLocation(document.getText(), document.offsetAt(position));
            var range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
            if (location.path[0] === 'recommendations') {
                var extensionsContent = jsonc_parser_1.parse(document.getText());
                return provideInstalledExtensionProposals(extensionsContent, range);
            }
            return [];
        }
    });
}
function registerExtensionsCompletionsInWorkspaceConfigurationDocument() {
    return vscode.languages.registerCompletionItemProvider({ pattern: '**/*.code-workspace' }, {
        provideCompletionItems: function (document, position, token) {
            var location = jsonc_parser_1.getLocation(document.getText(), document.offsetAt(position));
            var range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
            if (location.path[0] === 'extensions' && location.path[1] === 'recommendations') {
                var extensionsContent = jsonc_parser_1.parse(document.getText())['extensions'];
                return provideInstalledExtensionProposals(extensionsContent, range);
            }
            return [];
        }
    });
}
function provideInstalledExtensionProposals(extensionsContent, range) {
    var alreadyEnteredExtensions = extensionsContent && extensionsContent.recommendations || [];
    if (Array.isArray(alreadyEnteredExtensions)) {
        var knownExtensionProposals = vscode.extensions.all.filter(function (e) {
            return !(e.id.startsWith('vscode.')
                || e.id === 'Microsoft.vscode-markdown'
                || alreadyEnteredExtensions.indexOf(e.id) > -1);
        });
        if (knownExtensionProposals.length) {
            return knownExtensionProposals.map(function (e) {
                var item = new vscode.CompletionItem(e.id);
                var insertText = "\"" + e.id + "\"";
                item.kind = vscode.CompletionItemKind.Value;
                item.insertText = insertText;
                item.range = range;
                item.filterText = insertText;
                return item;
            });
        }
        else {
            var example = new vscode.CompletionItem(localize(11, null));
            example.insertText = '"vscode.csharp"';
            example.kind = vscode.CompletionItemKind.Value;
            example.range = range;
            return [example];
        }
    }
}
function newSimpleCompletionItem(label, range, description, insertText) {
    var item = new vscode.CompletionItem(label);
    item.kind = vscode.CompletionItemKind.Value;
    item.detail = description;
    item.insertText = insertText || label;
    item.range = range;
    return item;
}
function updateLaunchJsonDecorations(editor) {
    if (!editor || path.basename(editor.document.fileName) !== 'launch.json') {
        return;
    }
    var ranges = [];
    var addPropertyAndValue = false;
    var depthInArray = 0;
    jsonc_parser_1.visit(editor.document.getText(), {
        onObjectProperty: function (property, offset, length) {
            // Decorate attributes which are unlikely to be edited by the user.
            // Only decorate "configurations" if it is not inside an array (compounds have a configurations property which should not be decorated).
            addPropertyAndValue = property === 'version' || property === 'type' || property === 'request' || property === 'compounds' || (property === 'configurations' && depthInArray === 0);
            if (addPropertyAndValue) {
                ranges.push(new vscode.Range(editor.document.positionAt(offset), editor.document.positionAt(offset + length)));
            }
        },
        onLiteralValue: function (value, offset, length) {
            if (addPropertyAndValue) {
                ranges.push(new vscode.Range(editor.document.positionAt(offset), editor.document.positionAt(offset + length)));
            }
        },
        onArrayBegin: function (offset, length) {
            depthInArray++;
        },
        onArrayEnd: function (offset, length) {
            depthInArray--;
        }
    });
    editor.setDecorations(decoration, ranges);
}
vscode.languages.registerDocumentSymbolProvider({ pattern: '**/launch.json', language: 'jsonc' }, {
    provideDocumentSymbols: function (document, token) {
        var result = [];
        var name = '';
        var lastProperty = '';
        var startOffset = 0;
        var depthInObjects = 0;
        jsonc_parser_1.visit(document.getText(), {
            onObjectProperty: function (property, offset, length) {
                lastProperty = property;
            },
            onLiteralValue: function (value, offset, length) {
                if (lastProperty === 'name') {
                    name = value;
                }
            },
            onObjectBegin: function (offset, length) {
                depthInObjects++;
                if (depthInObjects === 2) {
                    startOffset = offset;
                }
            },
            onObjectEnd: function (offset, length) {
                if (name && depthInObjects === 2) {
                    result.push(new vscode.SymbolInformation(name, vscode.SymbolKind.Object, new vscode.Range(document.positionAt(startOffset), document.positionAt(offset))));
                }
                depthInObjects--;
            },
        });
        return result;
    }
});
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\configuration-editing\out/extension.js.map
