"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
require("mocha");
const foldingProvider_1 = require("../features/foldingProvider");
const inMemoryDocument_1 = require("./inMemoryDocument");
const engine_1 = require("./engine");
const testFileName = vscode.Uri.parse('test.md');
suite('markdown.FoldingProvider', () => {
    test('Should not return anything for empty document', async () => {
        const folds = await getFoldsForDocument(``);
        assert.strictEqual(folds.length, 0);
    });
    test('Should not return anything for document without headers', async () => {
        const folds = await getFoldsForDocument(`a
**b** afas
a#b
a`);
        assert.strictEqual(folds.length, 0);
    });
    test('Should fold from header to end of document', async () => {
        const folds = await getFoldsForDocument(`a
# b
c
d`);
        assert.strictEqual(folds.length, 1);
        const firstFold = folds[0];
        assert.strictEqual(firstFold.start, 1);
        assert.strictEqual(firstFold.end, 3);
    });
    test('Should leave single newline before next header', async () => {
        const folds = await getFoldsForDocument(`
# a
x

# b
y`);
        assert.strictEqual(folds.length, 2);
        const firstFold = folds[0];
        assert.strictEqual(firstFold.start, 1);
        assert.strictEqual(firstFold.end, 3);
    });
    test('Should collapse multuple newlines to single newline before next header', async () => {
        const folds = await getFoldsForDocument(`
# a
x



# b
y`);
        assert.strictEqual(folds.length, 2);
        const firstFold = folds[0];
        assert.strictEqual(firstFold.start, 1);
        assert.strictEqual(firstFold.end, 5);
    });
    test('Should not collapse if there is no newline before next header', async () => {
        const folds = await getFoldsForDocument(`
# a
x
# b
y`);
        assert.strictEqual(folds.length, 2);
        const firstFold = folds[0];
        assert.strictEqual(firstFold.start, 1);
        assert.strictEqual(firstFold.end, 2);
    });
});
async function getFoldsForDocument(contents) {
    const doc = new inMemoryDocument_1.InMemoryDocument(testFileName, contents);
    const provider = new foldingProvider_1.default(engine_1.createNewMarkdownEngine());
    return await provider.provideFoldingRanges(doc, {}, new vscode.CancellationTokenSource().token);
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/test\foldingProvider.test.js.map
