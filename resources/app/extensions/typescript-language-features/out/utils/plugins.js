"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
function getContributedTypeScriptServerPlugins() {
    const plugins = [];
    for (const extension of vscode_1.extensions.all) {
        const pack = extension.packageJSON;
        if (pack.contributes && pack.contributes.typescriptServerPlugins && Array.isArray(pack.contributes.typescriptServerPlugins)) {
            for (const plugin of pack.contributes.typescriptServerPlugins) {
                plugins.push({
                    name: plugin.name,
                    path: extension.extensionPath,
                    languages: Array.isArray(plugin.languages) ? plugin.languages : [],
                });
            }
        }
    }
    return plugins;
}
exports.getContributedTypeScriptServerPlugins = getContributedTypeScriptServerPlugins;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/utils\plugins.js.map
