/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const util_1 = require("./util");
const querystring = require("querystring");
class GitProtocolHandler {
    constructor() {
        this.disposables = [];
        this.disposables.push(vscode_1.window.registerProtocolHandler(this));
    }
    handleUri(uri) {
        switch (uri.path) {
            case '/clone': this.clone(uri);
        }
    }
    clone(uri) {
        const data = querystring.parse(uri.query);
        if (!data.url) {
            console.warn('Failed to open URI:', uri);
        }
        vscode_1.commands.executeCommand('git.clone', data.url);
    }
    dispose() {
        this.disposables = util_1.dispose(this.disposables);
    }
}
exports.GitProtocolHandler = GitProtocolHandler;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\git\out/protocolHandler.js.map
