"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const FrontMatterRegex = /^---\s*[^]*?(-{3}|\.{3})\s*/;
class MarkdownEngine {
    constructor(extensionPreviewResourceProvider, slugifier) {
        this.extensionPreviewResourceProvider = extensionPreviewResourceProvider;
        this.slugifier = slugifier;
    }
    usePlugin(factory) {
        try {
            this.md = factory(this.md);
        }
        catch (e) {
            // noop
        }
    }
    async getEngine(resource) {
        if (!this.md) {
            const hljs = await Promise.resolve().then(() => require('highlight.js'));
            const mdnh = await Promise.resolve().then(() => require('markdown-it-named-headers'));
            this.md = (await Promise.resolve().then(() => require('markdown-it')))({
                html: true,
                highlight: (str, lang) => {
                    // Workaround for highlight not supporting tsx: https://github.com/isagalaev/highlight.js/issues/1155
                    if (lang && ['tsx', 'typescriptreact'].indexOf(lang.toLocaleLowerCase()) >= 0) {
                        lang = 'jsx';
                    }
                    if (lang && hljs.getLanguage(lang)) {
                        try {
                            return `<div>${hljs.highlight(lang, str, true).value}</div>`;
                        }
                        catch (error) { }
                    }
                    return `<code><div>${this.md.utils.escapeHtml(str)}</div></code>`;
                }
            }).use(mdnh, {
                slugify: (header) => this.slugifier.fromHeading(header).value
            });
            for (const plugin of this.extensionPreviewResourceProvider.markdownItPlugins) {
                this.usePlugin(await plugin);
            }
            for (const renderName of ['paragraph_open', 'heading_open', 'image', 'code_block', 'fence', 'blockquote_open', 'list_item_open']) {
                this.addLineNumberRenderer(this.md, renderName);
            }
            this.addFencedRenderer(this.md);
            this.addLinkNormalizer(this.md);
            this.addLinkValidator(this.md);
        }
        const config = vscode.workspace.getConfiguration('markdown', resource);
        this.md.set({
            breaks: config.get('preview.breaks', false),
            linkify: config.get('preview.linkify', true)
        });
        return this.md;
    }
    stripFrontmatter(text) {
        let offset = 0;
        const frontMatterMatch = FrontMatterRegex.exec(text);
        if (frontMatterMatch) {
            const frontMatter = frontMatterMatch[0];
            offset = frontMatter.split(/\r\n|\n|\r/g).length - 1;
            text = text.substr(frontMatter.length);
        }
        return { text, offset };
    }
    async render(document, stripFrontmatter, text) {
        let offset = 0;
        if (stripFrontmatter) {
            const markdownContent = this.stripFrontmatter(text);
            offset = markdownContent.offset;
            text = markdownContent.text;
        }
        this.currentDocument = document;
        this.firstLine = offset;
        const engine = await this.getEngine(document);
        return engine.render(text);
    }
    async parse(document, source) {
        const { text, offset } = this.stripFrontmatter(source);
        this.currentDocument = document;
        const engine = await this.getEngine(document);
        return engine.parse(text, {}).map(token => {
            if (token.map) {
                token.map[0] += offset;
            }
            return token;
        });
    }
    addLineNumberRenderer(md, ruleName) {
        const original = md.renderer.rules[ruleName];
        md.renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            if (token.map && token.map.length) {
                token.attrSet('data-line', this.firstLine + token.map[0]);
                token.attrJoin('class', 'code-line');
            }
            if (original) {
                return original(tokens, idx, options, env, self);
            }
            else {
                return self.renderToken(tokens, idx, options, env, self);
            }
        };
    }
    addFencedRenderer(md) {
        const original = md.renderer.rules['fenced'];
        md.renderer.rules['fenced'] = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            if (token.map && token.map.length) {
                token.attrJoin('class', 'hljs');
            }
            return original(tokens, idx, options, env, self);
        };
    }
    addLinkNormalizer(md) {
        const normalizeLink = md.normalizeLink;
        md.normalizeLink = (link) => {
            try {
                let uri = vscode.Uri.parse(link);
                if (!uri.scheme && uri.path) {
                    // Assume it must be a file
                    const fragment = uri.fragment;
                    if (uri.path[0] === '/') {
                        const root = vscode.workspace.getWorkspaceFolder(this.currentDocument);
                        if (root) {
                            uri = vscode.Uri.file(path.join(root.uri.fsPath, uri.path));
                        }
                    }
                    else {
                        uri = vscode.Uri.file(path.join(path.dirname(this.currentDocument.path), uri.path));
                    }
                    if (fragment) {
                        uri = uri.with({
                            fragment: this.slugifier.fromHeading(fragment).value
                        });
                    }
                    return normalizeLink(uri.with({ scheme: 'vscode-resource' }).toString(true));
                }
                else if (!uri.scheme && !uri.path && uri.fragment) {
                    return normalizeLink(uri.with({
                        fragment: this.slugifier.fromHeading(uri.fragment).value
                    }).toString(true));
                }
            }
            catch (e) {
                // noop
            }
            return normalizeLink(link);
        };
    }
    addLinkValidator(md) {
        const validateLink = md.validateLink;
        md.validateLink = (link) => {
            // support file:// links
            return validateLink(link) || link.indexOf('file:') === 0;
        };
    }
}
exports.MarkdownEngine = MarkdownEngine;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/markdownEngine.js.map
