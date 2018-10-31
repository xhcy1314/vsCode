"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const file_1 = require("../util/file");
class ShowPreviewSecuritySelectorCommand {
    constructor(previewSecuritySelector, previewManager) {
        this.previewSecuritySelector = previewSecuritySelector;
        this.previewManager = previewManager;
        this.id = 'markdown.showPreviewSecuritySelector';
    }
    execute(resource) {
        if (this.previewManager.activePreviewResource) {
            this.previewSecuritySelector.showSecutitySelectorForResource(this.previewManager.activePreviewResource);
        }
        else if (resource) {
            const source = vscode.Uri.parse(resource);
            this.previewSecuritySelector.showSecutitySelectorForResource(source.query ? vscode.Uri.parse(source.query) : source);
        }
        else if (vscode.window.activeTextEditor && file_1.isMarkdownFile(vscode.window.activeTextEditor.document)) {
            this.previewSecuritySelector.showSecutitySelectorForResource(vscode.window.activeTextEditor.document.uri);
        }
    }
}
exports.ShowPreviewSecuritySelectorCommand = ShowPreviewSecuritySelectorCommand;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/commands\showPreviewSecuritySelector.js.map
