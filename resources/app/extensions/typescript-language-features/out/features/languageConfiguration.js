"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
/* --------------------------------------------------------------------------------------------
 * Includes code from typescript-sublime-plugin project, obtained from
 * https://github.com/Microsoft/TypeScript-Sublime-Plugin/blob/master/TypeScript%20Indent.tmPreferences
 * ------------------------------------------------------------------------------------------ */
const vscode = require("vscode");
const dispose_1 = require("../utils/dispose");
const languageModeIds = require("../utils/languageModeIds");
const jsTsLanguageConfiguration = {
    indentationRules: {
        // ^(.*\*/)?\s*\}.*$
        decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[\}\]\)].*$/,
        // ^.*\{[^}"']*$
        increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/
    },
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    onEnterRules: [
        {
            // e.g. /** | */
            beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
            afterText: /^\s*\*\/$/,
            action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: ' * ' }
        }, {
            // e.g. /** ...|
            beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
            action: { indentAction: vscode.IndentAction.None, appendText: ' * ' }
        }, {
            // e.g.  * ...|
            beforeText: /^(\t|[ ])*[ ]\*([ ]([^\*]|\*(?!\/))*)?$/,
            action: { indentAction: vscode.IndentAction.None, appendText: '* ' }
        }, {
            // e.g.  */|
            beforeText: /^(\t|[ ])*[ ]\*\/\s*$/,
            action: { indentAction: vscode.IndentAction.None, removeText: 1 }
        },
        {
            // e.g.  *-----*/|
            beforeText: /^(\t|[ ])*[ ]\*[^/]*\*\/\s*$/,
            action: { indentAction: vscode.IndentAction.None, removeText: 1 }
        }
    ]
};
const EMPTY_ELEMENTS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'];
const jsxTagsLanguageConfiguration = {
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
    onEnterRules: [
        {
            beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
            afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
            action: { indentAction: vscode.IndentAction.IndentOutdent }
        },
        {
            beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
            action: { indentAction: vscode.IndentAction.Indent }
        }
    ],
};
class LanguageConfigurationManager {
    constructor() {
        this._registrations = [];
        const standardLanguages = [
            languageModeIds.javascript,
            languageModeIds.javascriptreact,
            languageModeIds.typescript,
            languageModeIds.typescriptreact,
        ];
        for (const language of standardLanguages) {
            this.registerConfiguration(language, jsTsLanguageConfiguration);
        }
        this.registerConfiguration(languageModeIds.jsxTags, jsxTagsLanguageConfiguration);
    }
    registerConfiguration(language, config) {
        this._registrations.push(vscode.languages.setLanguageConfiguration(language, config));
    }
    dispose() {
        dispose_1.disposeAll(this._registrations);
    }
}
exports.LanguageConfigurationManager = LanguageConfigurationManager;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\languageConfiguration.js.map
