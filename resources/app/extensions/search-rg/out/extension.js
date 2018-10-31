"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var ripgrepTextSearch_1 = require("./ripgrepTextSearch");
var ripgrepFileSearch_1 = require("./ripgrepFileSearch");
function activate() {
    if (vscode.workspace.getConfiguration('searchRipgrep').get('enable')) {
        var outputChannel = vscode.window.createOutputChannel('search-rg');
        var provider = new RipgrepSearchProvider(outputChannel);
        vscode.workspace.registerSearchProvider('file', provider);
    }
}
exports.activate = activate;
var RipgrepSearchProvider = /** @class */ (function () {
    function RipgrepSearchProvider(outputChannel) {
        this.outputChannel = outputChannel;
    }
    RipgrepSearchProvider.prototype.provideTextSearchResults = function (query, options, progress, token) {
        var engine = new ripgrepTextSearch_1.RipgrepTextSearchEngine(this.outputChannel);
        return engine.provideTextSearchResults(query, options, progress, token);
    };
    RipgrepSearchProvider.prototype.provideFileSearchResults = function (options, progress, token) {
        var engine = new ripgrepFileSearch_1.RipgrepFileSearchEngine(this.outputChannel);
        return engine.provideFileSearchResults(options, progress, token);
    };
    return RipgrepSearchProvider;
}());
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\search-rg\out/extension.js.map
