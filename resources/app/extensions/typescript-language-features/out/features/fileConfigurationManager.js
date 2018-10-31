"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const languageIds = require("../utils/languageModeIds");
const api_1 = require("../utils/api");
function objsAreEqual(a, b) {
    let keys = Object.keys(a);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (a[key] !== b[key]) {
            return false;
        }
    }
    return true;
}
function areFileConfigurationsEqual(a, b) {
    return (objsAreEqual(a.formatOptions, b.formatOptions)
        && objsAreEqual(a.preferences, b.preferences));
}
class FileConfigurationManager {
    constructor(client) {
        this.client = client;
        this.formatOptions = Object.create(null);
        this.onDidCloseTextDocumentSub = vscode_1.workspace.onDidCloseTextDocument((textDocument) => {
            const key = textDocument.uri.toString();
            // When a document gets closed delete the cached formatting options.
            // This is necessary since the tsserver now closed a project when its
            // last file in it closes which drops the stored formatting options
            // as well.
            delete this.formatOptions[key];
        });
    }
    dispose() {
        if (this.onDidCloseTextDocumentSub) {
            this.onDidCloseTextDocumentSub.dispose();
            this.onDidCloseTextDocumentSub = undefined;
        }
    }
    async ensureConfigurationForDocument(document, token) {
        const editor = vscode_1.window.visibleTextEditors.find(editor => editor.document.fileName === document.fileName);
        if (editor) {
            const formattingOptions = {
                tabSize: editor.options.tabSize,
                insertSpaces: editor.options.insertSpaces
            };
            return this.ensureConfigurationOptions(document, formattingOptions, token);
        }
    }
    async ensureConfigurationOptions(document, options, token) {
        const file = this.client.toPath(document.uri);
        if (!file) {
            return;
        }
        const key = document.uri.toString();
        const cachedOptions = this.formatOptions[key];
        const currentOptions = this.getFileOptions(document, options);
        if (cachedOptions && areFileConfigurationsEqual(cachedOptions, currentOptions)) {
            return;
        }
        const args = Object.assign({ file }, currentOptions);
        await this.client.execute('configure', args, token);
        this.formatOptions[key] = currentOptions;
    }
    reset() {
        this.formatOptions = Object.create(null);
    }
    getFileOptions(document, options) {
        return {
            formatOptions: this.getFormatOptions(document, options),
            preferences: this.getPreferences(document)
        };
    }
    getFormatOptions(document, options) {
        const config = vscode_1.workspace.getConfiguration(isTypeScriptDocument(document) ? 'typescript.format' : 'javascript.format', document.uri);
        return {
            tabSize: options.tabSize,
            indentSize: options.tabSize,
            convertTabsToSpaces: options.insertSpaces,
            // We can use \n here since the editor normalizes later on to its line endings.
            newLineCharacter: '\n',
            insertSpaceAfterCommaDelimiter: config.get('insertSpaceAfterCommaDelimiter'),
            insertSpaceAfterConstructor: config.get('insertSpaceAfterConstructor'),
            insertSpaceAfterSemicolonInForStatements: config.get('insertSpaceAfterSemicolonInForStatements'),
            insertSpaceBeforeAndAfterBinaryOperators: config.get('insertSpaceBeforeAndAfterBinaryOperators'),
            insertSpaceAfterKeywordsInControlFlowStatements: config.get('insertSpaceAfterKeywordsInControlFlowStatements'),
            insertSpaceAfterFunctionKeywordForAnonymousFunctions: config.get('insertSpaceAfterFunctionKeywordForAnonymousFunctions'),
            insertSpaceBeforeFunctionParenthesis: config.get('insertSpaceBeforeFunctionParenthesis'),
            insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: config.get('insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis'),
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: config.get('insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets'),
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: config.get('insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces'),
            insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: config.get('insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces'),
            insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: config.get('insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces'),
            insertSpaceAfterTypeAssertion: config.get('insertSpaceAfterTypeAssertion'),
            placeOpenBraceOnNewLineForFunctions: config.get('placeOpenBraceOnNewLineForFunctions'),
            placeOpenBraceOnNewLineForControlBlocks: config.get('placeOpenBraceOnNewLineForControlBlocks'),
        };
    }
    getPreferences(document) {
        if (!this.client.apiVersion.gte(api_1.default.v290)) {
            return {};
        }
        const preferences = vscode_1.workspace.getConfiguration(isTypeScriptDocument(document) ? 'typescript.preferences' : 'javascript.preferences', document.uri);
        return {
            quotePreference: getQuoteStylePreference(preferences),
            importModuleSpecifierPreference: getImportModuleSpecifierPreference(preferences),
            allowTextChangesInNewFiles: document.uri.scheme === 'file'
        };
    }
}
exports.default = FileConfigurationManager;
function getQuoteStylePreference(config) {
    switch (config.get('quoteStyle')) {
        case 'single': return 'single';
        case 'double': return 'double';
        default: return undefined;
    }
}
function getImportModuleSpecifierPreference(config) {
    switch (config.get('importModuleSpecifier')) {
        case 'relative': return 'relative';
        case 'non-relative': return 'non-relative';
        default: return undefined;
    }
}
function isTypeScriptDocument(document) {
    return document.languageId === languageIds.typescript || document.languageId === languageIds.typescriptreact;
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\fileConfigurationManager.js.map
