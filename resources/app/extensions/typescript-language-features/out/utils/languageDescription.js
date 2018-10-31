"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const languageModeIds = require("./languageModeIds");
exports.standardLanguageDescriptions = [
    {
        id: 'typescript',
        diagnosticSource: 'ts',
        diagnosticOwner: 'typescript',
        modeIds: [languageModeIds.typescript, languageModeIds.typescriptreact],
        configFile: 'tsconfig.json'
    }, {
        id: 'javascript',
        diagnosticSource: 'ts',
        diagnosticOwner: 'typescript',
        modeIds: [languageModeIds.javascript, languageModeIds.javascriptreact],
        configFile: 'jsconfig.json'
    }
];
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/utils\languageDescription.js.map
