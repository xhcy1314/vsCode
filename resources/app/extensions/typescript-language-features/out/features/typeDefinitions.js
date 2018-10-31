"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const definitionProviderBase_1 = require("./definitionProviderBase");
const api_1 = require("../utils/api");
class TypeScriptTypeDefinitionProvider extends definitionProviderBase_1.default {
    provideTypeDefinition(document, position, token) {
        return this.getSymbolLocations('typeDefinition', document, position, token);
    }
}
exports.default = TypeScriptTypeDefinitionProvider;
function register(selector, client) {
    return new dependentRegistration_1.VersionDependentRegistration(client, api_1.default.v213, () => {
        return vscode.languages.registerTypeDefinitionProvider(selector, new TypeScriptTypeDefinitionProvider(client));
    });
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\typeDefinitions.js.map
