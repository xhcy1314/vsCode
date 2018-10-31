"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const resolveExtensionResource = (extension, resourcePath) => {
    return vscode.Uri.file(path.join(extension.extensionPath, resourcePath))
        .with({ scheme: 'vscode-resource' });
};
const resolveExtensionResources = (extension, resourcePaths) => {
    const result = [];
    if (Array.isArray(resourcePaths)) {
        for (const resource of resourcePaths) {
            try {
                result.push(resolveExtensionResource(extension, resource));
            }
            catch (e) {
                // noop
            }
        }
    }
    return result;
};
class MarkdownExtensionContributions {
    constructor() {
        this._scripts = [];
        this._styles = [];
        this._previewResourceRoots = [];
        this._plugins = [];
        this._loaded = false;
    }
    get previewScripts() {
        this.ensureLoaded();
        return this._scripts;
    }
    get previewStyles() {
        this.ensureLoaded();
        return this._styles;
    }
    get previewResourceRoots() {
        this.ensureLoaded();
        return this._previewResourceRoots;
    }
    get markdownItPlugins() {
        this.ensureLoaded();
        return this._plugins;
    }
    ensureLoaded() {
        if (this._loaded) {
            return;
        }
        this._loaded = true;
        for (const extension of vscode.extensions.all) {
            const contributes = extension.packageJSON && extension.packageJSON.contributes;
            if (!contributes) {
                continue;
            }
            this.tryLoadPreviewStyles(contributes, extension);
            this.tryLoadPreviewScripts(contributes, extension);
            this.tryLoadMarkdownItPlugins(contributes, extension);
            if (contributes['markdown.previewScripts'] || contributes['markdown.previewStyles']) {
                this._previewResourceRoots.push(vscode.Uri.file(extension.extensionPath));
            }
        }
    }
    tryLoadMarkdownItPlugins(contributes, extension) {
        if (contributes['markdown.markdownItPlugins']) {
            this._plugins.push(extension.activate().then(() => {
                if (extension.exports && extension.exports.extendMarkdownIt) {
                    return (md) => extension.exports.extendMarkdownIt(md);
                }
                return (md) => md;
            }));
        }
    }
    tryLoadPreviewScripts(contributes, extension) {
        this._scripts.push(...resolveExtensionResources(extension, contributes['markdown.previewScripts']));
    }
    tryLoadPreviewStyles(contributes, extension) {
        this._styles.push(...resolveExtensionResources(extension, contributes['markdown.previewStyles']));
    }
}
function getMarkdownExtensionContributions() {
    return new MarkdownExtensionContributions();
}
exports.getMarkdownExtensionContributions = getMarkdownExtensionContributions;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/markdownExtensions.js.map
