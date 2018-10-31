"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
function isImplicitProjectConfigFile(configFileName) {
    return configFileName.indexOf('/dev/null/') === 0;
}
exports.isImplicitProjectConfigFile = isImplicitProjectConfigFile;
function inferredProjectConfig(config) {
    const base = {
        module: 'commonjs',
        target: 'es2016',
        jsx: 'preserve'
    };
    if (config.checkJs) {
        base.checkJs = true;
    }
    if (config.experimentalDecorators) {
        base.experimentalDecorators = true;
    }
    return base;
}
exports.inferredProjectConfig = inferredProjectConfig;
function inferredProjectConfigSnippet(config) {
    const baseConfig = inferredProjectConfig(config);
    const compilerOptions = Object.keys(baseConfig).map(key => `"${key}": ${JSON.stringify(baseConfig[key])}`);
    return new vscode.SnippetString(`{
	"compilerOptions": {
		${compilerOptions.join(',\n\t\t')}$0
	},
	"exclude": [
		"node_modules",
		"**/node_modules/*"
	]
}`);
}
async function openOrCreateConfigFile(isTypeScriptProject, rootPath, config) {
    const configFile = vscode.Uri.file(path.join(rootPath, isTypeScriptProject ? 'tsconfig.json' : 'jsconfig.json'));
    const col = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
    try {
        const doc = await vscode.workspace.openTextDocument(configFile);
        return vscode.window.showTextDocument(doc, col);
    }
    catch (_a) {
        const doc = await vscode.workspace.openTextDocument(configFile.with({ scheme: 'untitled' }));
        const editor = await vscode.window.showTextDocument(doc, col);
        if (editor.document.getText().length === 0) {
            await editor.insertSnippet(inferredProjectConfigSnippet(config));
        }
        return editor;
    }
}
exports.openOrCreateConfigFile = openOrCreateConfigFile;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/utils\tsconfig.js.map
