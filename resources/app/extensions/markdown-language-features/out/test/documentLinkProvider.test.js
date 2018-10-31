"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
require("mocha");
const vscode = require("vscode");
const documentLinkProvider_1 = require("../features/documentLinkProvider");
const inMemoryDocument_1 = require("./inMemoryDocument");
const testFileName = vscode.Uri.parse('test.md');
const noopToken = new class {
    constructor() {
        this._onCancellationRequestedEmitter = new vscode.EventEmitter();
        this.onCancellationRequested = this._onCancellationRequestedEmitter.event;
    }
    get isCancellationRequested() { return false; }
};
function getLinksForFile(fileContents) {
    const doc = new inMemoryDocument_1.InMemoryDocument(testFileName, fileContents);
    const provider = new documentLinkProvider_1.default();
    return provider.provideDocumentLinks(doc, noopToken);
}
function assertRangeEqual(expected, actual) {
    assert.strictEqual(expected.start.line, actual.start.line);
    assert.strictEqual(expected.start.character, actual.start.character);
    assert.strictEqual(expected.end.line, actual.end.line);
    assert.strictEqual(expected.end.character, actual.end.character);
}
suite('markdown.DocumentLinkProvider', () => {
    test('Should not return anything for empty document', () => {
        const links = getLinksForFile('');
        assert.strictEqual(links.length, 0);
    });
    test('Should not return anything for simple document without links', () => {
        const links = getLinksForFile('# a\nfdasfdfsafsa');
        assert.strictEqual(links.length, 0);
    });
    test('Should detect basic http links', () => {
        const links = getLinksForFile('a [b](https://example.com) c');
        assert.strictEqual(links.length, 1);
        const [link] = links;
        assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 25));
    });
    test('Should detect basic workspace links', () => {
        {
            const links = getLinksForFile('a [b](./file) c');
            assert.strictEqual(links.length, 1);
            const [link] = links;
            assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 12));
        }
        {
            const links = getLinksForFile('a [b](file.png) c');
            assert.strictEqual(links.length, 1);
            const [link] = links;
            assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 14));
        }
    });
    test('Should detect links with title', () => {
        const links = getLinksForFile('a [b](https://example.com "abc") c');
        assert.strictEqual(links.length, 1);
        const [link] = links;
        assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 25));
    });
    test('Should handle links with balanced parens', () => {
        {
            const links = getLinksForFile('a [b](https://example.com/a()c) c');
            assert.strictEqual(links.length, 1);
            const [link] = links;
            assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 30));
        }
        {
            const links = getLinksForFile('a [b](https://example.com/a(b)c) c');
            assert.strictEqual(links.length, 1);
            const [link] = links;
            assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 31));
        }
        {
            // #49011
            const links = getLinksForFile('[A link](http://ThisUrlhasParens/A_link(in_parens))');
            assert.strictEqual(links.length, 1);
            const [link] = links;
            assertRangeEqual(link.range, new vscode.Range(0, 9, 0, 50));
        }
    });
    test('Should handle two links without space', () => {
        const links = getLinksForFile('a ([test](test)[test2](test2)) c');
        assert.strictEqual(links.length, 2);
        const [link1, link2] = links;
        assertRangeEqual(link1.range, new vscode.Range(0, 10, 0, 14));
        assertRangeEqual(link2.range, new vscode.Range(0, 23, 0, 28));
    });
});
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/test\documentLinkProvider.test.js.map
