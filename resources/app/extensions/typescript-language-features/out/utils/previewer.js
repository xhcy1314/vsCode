"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
function getTagBodyText(tag) {
    if (!tag.text) {
        return undefined;
    }
    switch (tag.name) {
        case 'example':
        case 'default':
            // Convert to markdown code block if it not already one
            if (tag.text.match(/^\s*[~`]{3}/g)) {
                return tag.text;
            }
            return '```\n' + tag.text + '\n```';
    }
    return tag.text;
}
function getTagDocumentation(tag) {
    switch (tag.name) {
        case 'param':
            const body = (tag.text || '').split(/^([\w\.]+)\s*/);
            if (body && body.length === 3) {
                const param = body[1];
                const doc = body[2];
                const label = `*@${tag.name}* \`${param}\``;
                if (!doc) {
                    return label;
                }
                return label + (doc.match(/\r\n|\n/g) ? '  \n' + doc : ` — ${doc}`);
            }
    }
    // Generic tag
    const label = `*@${tag.name}*`;
    const text = getTagBodyText(tag);
    if (!text) {
        return label;
    }
    return label + (text.match(/\r\n|\n/g) ? '  \n' + text : ` — ${text}`);
}
function plain(parts) {
    if (!parts) {
        return '';
    }
    return parts.map(part => part.text).join('');
}
exports.plain = plain;
function tagsMarkdownPreview(tags) {
    return (tags || [])
        .map(getTagDocumentation)
        .join('  \n\n');
}
exports.tagsMarkdownPreview = tagsMarkdownPreview;
function markdownDocumentation(documentation, tags) {
    const out = new vscode_1.MarkdownString();
    addMarkdownDocumentation(out, documentation, tags);
    return out;
}
exports.markdownDocumentation = markdownDocumentation;
function addMarkdownDocumentation(out, documentation, tags) {
    out.appendMarkdown(plain(documentation));
    const tagsPreview = tagsMarkdownPreview(tags);
    if (tagsPreview) {
        out.appendMarkdown('\n\n' + tagsPreview);
    }
    return out;
}
exports.addMarkdownDocumentation = addMarkdownDocumentation;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/utils\previewer.js.map
