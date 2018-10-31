"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const api_1 = require("../utils/api");
const typeConverters = require("../utils/typeConverters");
const definitionProviderBase_1 = require("./definitionProviderBase");
class TypeScriptDefinitionProvider extends definitionProviderBase_1.default {
    constructor(client) {
        super(client);
    }
    async provideDefinition() {
        // Implemented by provideDefinition2
        return undefined;
    }
    async provideDefinition2(document, position, token) {
        if (this.client.apiVersion.gte(api_1.default.v270)) {
            const filepath = this.client.toPath(document.uri);
            if (!filepath) {
                return undefined;
            }
            const args = typeConverters.Position.toFileLocationRequestArgs(filepath, position);
            try {
                const response = await this.client.execute('definitionAndBoundSpan', args, token);
                const locations = (response && response.body && response.body.definitions) || [];
                if (!locations) {
                    return undefined;
                }
                const span = response.body.textSpan ? typeConverters.Range.fromTextSpan(response.body.textSpan) : undefined;
                return locations
                    .map(location => {
                    const loc = typeConverters.Location.fromTextSpan(this.client.toResource(location.file), location);
                    return Object.assign({ origin: span }, loc);
                });
            }
            catch (_a) {
                return [];
            }
        }
        return this.getSymbolLocations('definition', document, position, token);
    }
}
exports.default = TypeScriptDefinitionProvider;
function register(selector, client) {
    return vscode.languages.registerDefinitionProvider(selector, new TypeScriptDefinitionProvider(client));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\definitions.js.map
