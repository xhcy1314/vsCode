/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
var assert = require("assert");
var path = require("path");
var vscode_uri_1 = require("vscode-uri");
var vscode_languageserver_types_1 = require("vscode-languageserver-types");
var pathCompletion_1 = require("../pathCompletion");
var vscode_css_languageservice_1 = require("vscode-css-languageservice");
suite('Completions', function () {
    var cssLanguageService = vscode_css_languageservice_1.getCSSLanguageService();
    var assertCompletion = function (completions, expected, document, offset) {
        var matches = completions.items.filter(function (completion) {
            return completion.label === expected.label;
        });
        assert.equal(matches.length, 1, expected.label + " should only existing once: Actual: " + completions.items.map(function (c) { return c.label; }).join(', '));
        var match = matches[0];
        if (expected.resultText && match.textEdit) {
            assert.equal(vscode_languageserver_types_1.TextDocument.applyEdits(document, [match.textEdit]), expected.resultText);
        }
    };
    function assertCompletions(value, expected, testUri, workspaceFolders) {
        var offset = value.indexOf('|');
        value = value.substr(0, offset) + value.substr(offset + 1);
        var document = vscode_languageserver_types_1.TextDocument.create(testUri, 'css', 0, value);
        var position = document.positionAt(offset);
        if (!workspaceFolders) {
            workspaceFolders = [{ name: 'x', uri: testUri.substr(0, testUri.lastIndexOf('/')) }];
        }
        var participantResult = vscode_languageserver_types_1.CompletionList.create([]);
        cssLanguageService.setCompletionParticipants([pathCompletion_1.getPathCompletionParticipant(document, workspaceFolders, participantResult)]);
        var stylesheet = cssLanguageService.parseStylesheet(document);
        var list = cssLanguageService.doComplete(document, position, stylesheet);
        list.items = list.items.concat(participantResult.items);
        if (expected.count) {
            assert.equal(list.items.length, expected.count);
        }
        if (expected.items) {
            for (var _i = 0, _a = expected.items; _i < _a.length; _i++) {
                var item = _a[_i];
                assertCompletion(list, item, document, offset);
            }
        }
    }
    test('CSS Path completion', function () {
        var testUri = vscode_uri_1.default.file(path.resolve(__dirname, '../../test/pathCompletionFixtures/about/about.css')).toString();
        var folders = [{ name: 'x', uri: vscode_uri_1.default.file(path.resolve(__dirname, '../../test')).toString() }];
        assertCompletions('html { background-image: url("./|")', {
            items: [
                { label: 'about.html', resultText: 'html { background-image: url("./about.html")' }
            ]
        }, testUri, folders);
        assertCompletions("html { background-image: url('../|')", {
            items: [
                { label: 'about/', resultText: "html { background-image: url('../about/')" },
                { label: 'index.html', resultText: "html { background-image: url('../index.html')" },
                { label: 'src/', resultText: "html { background-image: url('../src/')" }
            ]
        }, testUri, folders);
        assertCompletions("html { background-image: url('../src/a|')", {
            items: [
                { label: 'feature.js', resultText: "html { background-image: url('../src/feature.js')" },
                { label: 'data/', resultText: "html { background-image: url('../src/data/')" },
                { label: 'test.js', resultText: "html { background-image: url('../src/test.js')" }
            ]
        }, testUri, folders);
        assertCompletions("html { background-image: url('../src/data/f|.asar')", {
            items: [
                { label: 'foo.asar', resultText: "html { background-image: url('../src/data/foo.asar')" }
            ]
        }, testUri, folders);
        assertCompletions("html { background-image: url('|')", {
            items: [
                { label: 'about.css', resultText: "html { background-image: url('about.css')" },
                { label: 'about.html', resultText: "html { background-image: url('about.html')" },
            ]
        }, testUri, folders);
        assertCompletions("html { background-image: url('/|')", {
            items: [
                { label: 'pathCompletionFixtures/', resultText: "html { background-image: url('/pathCompletionFixtures/')" }
            ]
        }, testUri, folders);
        assertCompletions("html { background-image: url('/pathCompletionFixtures/|')", {
            items: [
                { label: 'about/', resultText: "html { background-image: url('/pathCompletionFixtures/about/')" },
                { label: 'index.html', resultText: "html { background-image: url('/pathCompletionFixtures/index.html')" },
                { label: 'src/', resultText: "html { background-image: url('/pathCompletionFixtures/src/')" }
            ]
        }, testUri, folders);
        assertCompletions("html { background-image: url(\"/|\")", {
            items: [
                { label: 'pathCompletionFixtures/', resultText: "html { background-image: url(\"/pathCompletionFixtures/\")" }
            ]
        }, testUri, folders);
    });
    test('CSS Path Completion - Unquoted url', function () {
        var testUri = vscode_uri_1.default.file(path.resolve(__dirname, '../../test/pathCompletionFixtures/about/about.css')).toString();
        var folders = [{ name: 'x', uri: vscode_uri_1.default.file(path.resolve(__dirname, '../../test')).toString() }];
        assertCompletions('html { background-image: url(./|)', {
            items: [
                { label: 'about.html', resultText: 'html { background-image: url(./about.html)' }
            ]
        }, testUri, folders);
        assertCompletions('html { background-image: url(./a|)', {
            items: [
                { label: 'about.html', resultText: 'html { background-image: url(./about.html)' }
            ]
        }, testUri, folders);
        assertCompletions('html { background-image: url(../|src/)', {
            items: [
                { label: 'about/', resultText: 'html { background-image: url(../about/)' }
            ]
        }, testUri, folders);
        assertCompletions('html { background-image: url(../s|rc/)', {
            items: [
                { label: 'about/', resultText: 'html { background-image: url(../about/)' }
            ]
        }, testUri, folders);
    });
});
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\css-language-features\server\out/test\completion.test.js.map
