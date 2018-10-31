"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const typeConverters = require("../utils/typeConverters");
const api_1 = require("../utils/api");
class TypeScriptReferenceSupport {
    constructor(client) {
        this.client = client;
    }
    async provideReferences(document, position, options, token) {
        const filepath = this.client.toPath(document.uri);
        if (!filepath) {
            return [];
        }
        const args = typeConverters.Position.toFileLocationRequestArgs(filepath, position);
        try {
            const msg = await this.client.execute('references', args, token);
            if (!msg.body) {
                return [];
            }
            const result = [];
            const has203Features = this.client.apiVersion.gte(api_1.default.v203);
            for (const ref of msg.body.refs) {
                if (!options.includeDeclaration && has203Features && ref.isDefinition) {
                    continue;
                }
                const url = this.client.toResource(ref.file);
                const location = typeConverters.Location.fromTextSpan(url, ref);
                result.push(location);
            }
            return result;
        }
        catch (_a) {
            return [];
        }
    }
}
function register(selector, client) {
    return vscode.languages.registerReferenceProvider(selector, new TypeScriptReferenceSupport(client));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\references.js.map
