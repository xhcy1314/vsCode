"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const nls = require("vscode-nls");
const PConst = require("../protocol.const");
const api_1 = require("../utils/api");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const typeConverters = require("../utils/typeConverters");
const baseCodeLensProvider_1 = require("./baseCodeLensProvider");
const localize = nls.loadMessageBundle(__filename);
class TypeScriptReferencesCodeLensProvider extends baseCodeLensProvider_1.TypeScriptBaseCodeLensProvider {
    resolveCodeLens(inputCodeLens, token) {
        const codeLens = inputCodeLens;
        const args = typeConverters.Position.toFileLocationRequestArgs(codeLens.file, codeLens.range.start);
        return this.client.execute('references', args, token).then(response => {
            if (!response || !response.body) {
                throw codeLens;
            }
            const locations = response.body.refs
                .map(reference => typeConverters.Location.fromTextSpan(this.client.toResource(reference.file), reference))
                .filter(location => 
            // Exclude original definition from references
            !(location.uri.toString() === codeLens.document.toString() &&
                location.range.start.isEqual(codeLens.range.start)));
            codeLens.command = {
                title: locations.length === 1
                    ? localize(0, null)
                    : localize(1, null, locations.length),
                command: locations.length ? 'editor.action.showReferences' : '',
                arguments: [codeLens.document, codeLens.range.start, locations]
            };
            return codeLens;
        }).catch(() => {
            codeLens.command = {
                title: localize(2, null),
                command: ''
            };
            return codeLens;
        });
    }
    extractSymbol(document, item, parent) {
        if (parent && parent.kind === PConst.Kind.enum) {
            return super.getSymbolRange(document, item);
        }
        switch (item.kind) {
            case PConst.Kind.const:
            case PConst.Kind.let:
            case PConst.Kind.variable:
            case PConst.Kind.function:
                // Only show references for exported variables
                if (!item.kindModifiers.match(/\bexport\b/)) {
                    break;
                }
            // fallthrough
            case PConst.Kind.class:
                if (item.text === '<class>') {
                    break;
                }
            // fallthrough
            case PConst.Kind.memberFunction:
            case PConst.Kind.memberVariable:
            case PConst.Kind.memberGetAccessor:
            case PConst.Kind.memberSetAccessor:
            case PConst.Kind.constructorImplementation:
            case PConst.Kind.interface:
            case PConst.Kind.type:
            case PConst.Kind.enum:
                return super.getSymbolRange(document, item);
        }
        return null;
    }
}
function register(selector, modeId, client, cachedResponse) {
    return new dependentRegistration_1.VersionDependentRegistration(client, api_1.default.v206, () => new dependentRegistration_1.ConfigurationDependentRegistration(modeId, 'referencesCodeLens.enabled', () => {
        return vscode.languages.registerCodeLensProvider(selector, new TypeScriptReferencesCodeLensProvider(client, cachedResponse));
    }));
}
exports.register = register;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\referencesCodeLens.js.map
