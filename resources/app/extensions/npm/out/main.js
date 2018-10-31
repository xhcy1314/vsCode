/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const httpRequest = require("request-light");
const vscode = require("vscode");
const jsonContributions_1 = require("./features/jsonContributions");
const npmView_1 = require("./npmView");
const tasks_1 = require("./tasks");
let taskProvider;
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        taskProvider = registerTaskProvider(context);
        const treeDataProvider = registerExplorer(context);
        configureHttpRequest();
        vscode.workspace.onDidChangeConfiguration((e) => {
            configureHttpRequest();
            if (e.affectsConfiguration('npm.exclude')) {
                tasks_1.invalidateScriptsCache();
                if (treeDataProvider) {
                    treeDataProvider.refresh();
                }
            }
            if (e.affectsConfiguration('npm.scriptExplorerAction')) {
                if (treeDataProvider) {
                    treeDataProvider.refresh();
                }
            }
        });
        context.subscriptions.push(jsonContributions_1.addJSONProviders(httpRequest.xhr));
    });
}
exports.activate = activate;
function registerTaskProvider(context) {
    if (vscode.workspace.workspaceFolders) {
        let watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
        watcher.onDidChange((_e) => tasks_1.invalidateScriptsCache());
        watcher.onDidDelete((_e) => tasks_1.invalidateScriptsCache());
        watcher.onDidCreate((_e) => tasks_1.invalidateScriptsCache());
        context.subscriptions.push(watcher);
        let provider = {
            provideTasks: () => __awaiter(this, void 0, void 0, function* () {
                return tasks_1.provideNpmScripts();
            }),
            resolveTask(_task) {
                return undefined;
            }
        };
        return vscode.workspace.registerTaskProvider('npm', provider);
    }
    return undefined;
}
function registerExplorer(context) {
    if (vscode.workspace.workspaceFolders) {
        let treeDataProvider = new npmView_1.NpmScriptsTreeDataProvider(context);
        let disposable = vscode.window.registerTreeDataProvider('npm', treeDataProvider);
        context.subscriptions.push(disposable);
        return treeDataProvider;
    }
    return undefined;
}
function configureHttpRequest() {
    const httpSettings = vscode.workspace.getConfiguration('http');
    httpRequest.configure(httpSettings.get('proxy', ''), httpSettings.get('proxyStrictSSL', true));
}
function deactivate() {
    if (taskProvider) {
        taskProvider.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\npm\out/main.js.map
