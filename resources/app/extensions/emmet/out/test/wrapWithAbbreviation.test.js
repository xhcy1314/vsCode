"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const assert = require("assert");
const vscode_1 = require("vscode");
const testUtils_1 = require("./testUtils");
const abbreviationActions_1 = require("../abbreviationActions");
const htmlContentsForWrapTests = `
	<ul class="nav main">
		<li class="item1">img</li>
		<li class="item2">$hithere</li>
	</ul>
`;
const wrapBlockElementExpected = `
	<ul class="nav main">
		<div>
			<li class="item1">img</li>
		</div>
		<div>
			<li class="item2">$hithere</li>
		</div>
	</ul>
`;
const wrapInlineElementExpected = `
	<ul class="nav main">
		<span><li class="item1">img</li></span>
		<span><li class="item2">$hithere</li></span>
	</ul>
`;
const wrapSnippetExpected = `
	<ul class="nav main">
		<a href=""><li class="item1">img</li></a>
		<a href=""><li class="item2">$hithere</li></a>
	</ul>
`;
const wrapMultiLineAbbrExpected = `
	<ul class="nav main">
		<ul>
			<li>
				<li class="item1">img</li>
			</li>
		</ul>
		<ul>
			<li>
				<li class="item2">$hithere</li>
			</li>
		</ul>
	</ul>
`;
suite('Tests for Wrap with Abbreviations', () => {
    teardown(testUtils_1.closeAllEditors);
    const multiCursors = [new vscode_1.Selection(2, 6, 2, 6), new vscode_1.Selection(3, 6, 3, 6)];
    const multiCursorsWithSelection = [new vscode_1.Selection(2, 2, 2, 28), new vscode_1.Selection(3, 2, 3, 33)];
    const multiCursorsWithFullLineSelection = [new vscode_1.Selection(2, 0, 2, 28), new vscode_1.Selection(3, 0, 4, 0)];
    test('Wrap with block element using multi cursor', () => {
        return testWrapWithAbbreviation(multiCursors, 'div', wrapBlockElementExpected);
    });
    test('Wrap with inline element using multi cursor', () => {
        return testWrapWithAbbreviation(multiCursors, 'span', wrapInlineElementExpected);
    });
    test('Wrap with snippet using multi cursor', () => {
        return testWrapWithAbbreviation(multiCursors, 'a', wrapSnippetExpected);
    });
    test('Wrap with multi line abbreviation using multi cursor', () => {
        return testWrapWithAbbreviation(multiCursors, 'ul>li', wrapMultiLineAbbrExpected);
    });
    test('Wrap with block element using multi cursor selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithSelection, 'div', wrapBlockElementExpected);
    });
    test('Wrap with inline element using multi cursor selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithSelection, 'span', wrapInlineElementExpected);
    });
    test('Wrap with snippet using multi cursor selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithSelection, 'a', wrapSnippetExpected);
    });
    test('Wrap with multi line abbreviation using multi cursor selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithSelection, 'ul>li', wrapMultiLineAbbrExpected);
    });
    test('Wrap with block element using multi cursor full line selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithFullLineSelection, 'div', wrapBlockElementExpected);
    });
    test('Wrap with inline element using multi cursor full line selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithFullLineSelection, 'span', wrapInlineElementExpected);
    });
    test('Wrap with snippet using multi cursor full line selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithFullLineSelection, 'a', wrapSnippetExpected);
    });
    test('Wrap with multi line abbreviation using multi cursor full line selection', () => {
        return testWrapWithAbbreviation(multiCursorsWithFullLineSelection, 'ul>li', wrapMultiLineAbbrExpected);
    });
    test('Wrap with abbreviation and comment filter', () => {
        const contents = `
	<ul class="nav main">
		line
	</ul>
	`;
        const expectedContents = `
	<ul class="nav main">
		<li class="hello">
			line
		</li>
		<!-- /.hello -->
	</ul>
	`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(2, 0, 2, 0)];
            const promise = abbreviationActions_1.wrapWithAbbreviation({ abbreviation: 'li.hello|c' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap returned undefined instead of promise.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), expectedContents);
                return Promise.resolve();
            });
        });
    });
    test('Wrap with abbreviation entire node when cursor is on opening tag', () => {
        const contents = `
	<div class="nav main">
		hello
	</div>
	`;
        const expectedContents = `
	<div>
		<div class="nav main">
			hello
		</div>
	</div>
	`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(1, 1, 1, 1)];
            const promise = abbreviationActions_1.wrapWithAbbreviation({ abbreviation: 'div' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap returned undefined instead of promise.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), expectedContents);
                return Promise.resolve();
            });
        });
    });
    test('Wrap with abbreviation entire node when cursor is on closing tag', () => {
        const contents = `
	<div class="nav main">
		hello
	</div>
	`;
        const expectedContents = `
	<div>
		<div class="nav main">
			hello
		</div>
	</div>
	`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(3, 1, 3, 1)];
            const promise = abbreviationActions_1.wrapWithAbbreviation({ abbreviation: 'div' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap returned undefined instead of promise.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), expectedContents);
                return Promise.resolve();
            });
        });
    });
    test('Wrap with multiline abbreviation doesnt add extra spaces', () => {
        // Issue #29898
        const contents = `
	hello
	`;
        const expectedContents = `
	<ul>
		<li><a href="">hello</a></li>
	</ul>
	`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(1, 2, 1, 2)];
            const promise = abbreviationActions_1.wrapWithAbbreviation({ abbreviation: 'ul>li>a' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap returned undefined instead of promise.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), expectedContents);
                return Promise.resolve();
            });
        });
    });
    test('Wrap individual lines with abbreviation', () => {
        const contents = `
	<ul class="nav main">
		<li class="item1">This $10 is not a tabstop</li>
		<li class="item2">hi.there</li>
	</ul>
`;
        const wrapIndividualLinesExpected = `
	<ul class="nav main">
		<ul>
			<li class="hello1"><li class="item1">This $10 is not a tabstop</li></li>
			<li class="hello2"><li class="item2">hi.there</li></li>
		</ul>
	</ul>
`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(2, 2, 3, 33)];
            const promise = abbreviationActions_1.wrapIndividualLinesWithAbbreviation({ abbreviation: 'ul>li.hello$*' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap Individual Lines with Abbreviation returned undefined.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), wrapIndividualLinesExpected);
                return Promise.resolve();
            });
        });
    });
    test('Wrap individual lines with abbreviation with extra space selected', () => {
        const contents = `
	<ul class="nav main">
		<li class="item1">img</li>
		<li class="item2">hi.there</li>
	</ul>
`;
        const wrapIndividualLinesExpected = `
	<ul class="nav main">
		<ul>
			<li class="hello1"><li class="item1">img</li></li>
			<li class="hello2"><li class="item2">hi.there</li></li>
		</ul>
	</ul>
`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(2, 1, 4, 0)];
            const promise = abbreviationActions_1.wrapIndividualLinesWithAbbreviation({ abbreviation: 'ul>li.hello$*' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap Individual Lines with Abbreviation returned undefined.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), wrapIndividualLinesExpected);
                return Promise.resolve();
            });
        });
    });
    test('Wrap individual lines with abbreviation with comment filter', () => {
        const contents = `
	<ul class="nav main">
		<li class="item1">img</li>
		<li class="item2">hi.there</li>
	</ul>
`;
        const wrapIndividualLinesExpected = `
	<ul class="nav main">
		<ul>
			<li class="hello"><li class="item1">img</li></li>
			<!-- /.hello -->
			<li class="hello"><li class="item2">hi.there</li></li>
			<!-- /.hello -->
		</ul>
	</ul>
`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(2, 2, 3, 33)];
            const promise = abbreviationActions_1.wrapIndividualLinesWithAbbreviation({ abbreviation: 'ul>li.hello*|c' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap Individual Lines with Abbreviation returned undefined.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), wrapIndividualLinesExpected);
                return Promise.resolve();
            });
        });
    });
    test('Wrap individual lines with abbreviation and trim', () => {
        const contents = `
		<ul class="nav main">
			• lorem ipsum
			• lorem ipsum
		</ul>
	`;
        const wrapIndividualLinesExpected = `
		<ul class="nav main">
			<ul>
				<li class="hello1">lorem ipsum</li>
				<li class="hello2">lorem ipsum</li>
			</ul>
		</ul>
	`;
        return testUtils_1.withRandomFileEditor(contents, 'html', (editor, doc) => {
            editor.selections = [new vscode_1.Selection(2, 3, 3, 16)];
            const promise = abbreviationActions_1.wrapIndividualLinesWithAbbreviation({ abbreviation: 'ul>li.hello$*|t' });
            if (!promise) {
                assert.equal(1, 2, 'Wrap Individual Lines with Abbreviation returned undefined.');
                return Promise.resolve();
            }
            return promise.then(() => {
                assert.equal(editor.document.getText(), wrapIndividualLinesExpected);
                return Promise.resolve();
            });
        });
    });
});
function testWrapWithAbbreviation(selections, abbreviation, expectedContents) {
    return testUtils_1.withRandomFileEditor(htmlContentsForWrapTests, 'html', (editor, doc) => {
        editor.selections = selections;
        const promise = abbreviationActions_1.wrapWithAbbreviation({ abbreviation });
        if (!promise) {
            assert.equal(1, 2, 'Wrap  with Abbreviation returned undefined.');
            return Promise.resolve();
        }
        return promise.then(() => {
            assert.equal(editor.document.getText(), expectedContents);
            return Promise.resolve();
        });
    });
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\emmet\out/test\wrapWithAbbreviation.test.js.map
