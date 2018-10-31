"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class MarkdownPreviewConfiguration {
    static getForResource(resource) {
        return new MarkdownPreviewConfiguration(resource);
    }
    constructor(resource) {
        const editorConfig = vscode.workspace.getConfiguration('editor', resource);
        const markdownConfig = vscode.workspace.getConfiguration('markdown', resource);
        const markdownEditorConfig = vscode.workspace.getConfiguration('[markdown]', resource);
        this.scrollBeyondLastLine = editorConfig.get('scrollBeyondLastLine', false);
        this.wordWrap = editorConfig.get('wordWrap', 'off') !== 'off';
        if (markdownEditorConfig && markdownEditorConfig['editor.wordWrap']) {
            this.wordWrap = markdownEditorConfig['editor.wordWrap'] !== 'off';
        }
        this.previewFrontMatter = markdownConfig.get('previewFrontMatter', 'hide');
        this.scrollPreviewWithEditor = !!markdownConfig.get('preview.scrollPreviewWithEditor', true);
        this.scrollEditorWithPreview = !!markdownConfig.get('preview.scrollEditorWithPreview', true);
        this.lineBreaks = !!markdownConfig.get('preview.breaks', false);
        this.doubleClickToSwitchToEditor = !!markdownConfig.get('preview.doubleClickToSwitchToEditor', true);
        this.markEditorSelection = !!markdownConfig.get('preview.markEditorSelection', true);
        this.fontFamily = markdownConfig.get('preview.fontFamily', undefined);
        this.fontSize = Math.max(8, +markdownConfig.get('preview.fontSize', NaN));
        this.lineHeight = Math.max(0.6, +markdownConfig.get('preview.lineHeight', NaN));
        this.styles = markdownConfig.get('styles', []);
    }
    isEqualTo(otherConfig) {
        for (let key in this) {
            if (this.hasOwnProperty(key) && key !== 'styles') {
                if (this[key] !== otherConfig[key]) {
                    return false;
                }
            }
        }
        // Check styles
        if (this.styles.length !== otherConfig.styles.length) {
            return false;
        }
        for (let i = 0; i < this.styles.length; ++i) {
            if (this.styles[i] !== otherConfig.styles[i]) {
                return false;
            }
        }
        return true;
    }
}
exports.MarkdownPreviewConfiguration = MarkdownPreviewConfiguration;
class MarkdownPreviewConfigurationManager {
    constructor() {
        this.previewConfigurationsForWorkspaces = new Map();
    }
    loadAndCacheConfiguration(resource) {
        const config = MarkdownPreviewConfiguration.getForResource(resource);
        this.previewConfigurationsForWorkspaces.set(this.getKey(resource), config);
        return config;
    }
    hasConfigurationChanged(resource) {
        const key = this.getKey(resource);
        const currentConfig = this.previewConfigurationsForWorkspaces.get(key);
        const newConfig = MarkdownPreviewConfiguration.getForResource(resource);
        return (!currentConfig || !currentConfig.isEqualTo(newConfig));
    }
    getKey(resource) {
        const folder = vscode.workspace.getWorkspaceFolder(resource);
        return folder ? folder.uri.toString() : '';
    }
}
exports.MarkdownPreviewConfigurationManager = MarkdownPreviewConfigurationManager;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/features\previewConfig.js.map
