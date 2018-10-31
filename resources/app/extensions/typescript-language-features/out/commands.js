"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const tsconfig_1 = require("./utils/tsconfig");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
class ReloadTypeScriptProjectsCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'typescript.reloadProjects';
    }
    execute() {
        this.lazyClientHost.value.reloadProjects();
    }
}
exports.ReloadTypeScriptProjectsCommand = ReloadTypeScriptProjectsCommand;
class ReloadJavaScriptProjectsCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'javascript.reloadProjects';
    }
    execute() {
        this.lazyClientHost.value.reloadProjects();
    }
}
exports.ReloadJavaScriptProjectsCommand = ReloadJavaScriptProjectsCommand;
class SelectTypeScriptVersionCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'typescript.selectTypeScriptVersion';
    }
    execute() {
        this.lazyClientHost.value.serviceClient.onVersionStatusClicked();
    }
}
exports.SelectTypeScriptVersionCommand = SelectTypeScriptVersionCommand;
class OpenTsServerLogCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'typescript.openTsServerLog';
    }
    execute() {
        this.lazyClientHost.value.serviceClient.openTsServerLogFile();
    }
}
exports.OpenTsServerLogCommand = OpenTsServerLogCommand;
class RestartTsServerCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'typescript.restartTsServer';
    }
    execute() {
        this.lazyClientHost.value.serviceClient.restartTsServer();
    }
}
exports.RestartTsServerCommand = RestartTsServerCommand;
class TypeScriptGoToProjectConfigCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'typescript.goToProjectConfig';
    }
    execute() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            goToProjectConfig(this.lazyClientHost.value, true, editor.document.uri);
        }
    }
}
exports.TypeScriptGoToProjectConfigCommand = TypeScriptGoToProjectConfigCommand;
class JavaScriptGoToProjectConfigCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'javascript.goToProjectConfig';
    }
    execute() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            goToProjectConfig(this.lazyClientHost.value, false, editor.document.uri);
        }
    }
}
exports.JavaScriptGoToProjectConfigCommand = JavaScriptGoToProjectConfigCommand;
async function goToProjectConfig(clientHost, isTypeScriptProject, resource) {
    const client = clientHost.serviceClient;
    const rootPath = client.getWorkspaceRootForResource(resource);
    if (!rootPath) {
        vscode.window.showInformationMessage(localize(0, null));
        return;
    }
    const file = client.toPath(resource);
    // TSServer errors when 'projectInfo' is invoked on a non js/ts file
    if (!file || !await clientHost.handles(resource)) {
        vscode.window.showWarningMessage(localize(1, null));
        return;
    }
    let res = undefined;
    try {
        res = await client.execute('projectInfo', { file, needFileNameList: false });
    }
    catch (_a) {
        // noop
    }
    if (!res || !res.body) {
        vscode.window.showWarningMessage(localize(2, null));
        return;
    }
    const { configFileName } = res.body;
    if (configFileName && !tsconfig_1.isImplicitProjectConfigFile(configFileName)) {
        const doc = await vscode.workspace.openTextDocument(configFileName);
        vscode.window.showTextDocument(doc, vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined);
        return;
    }
    let ProjectConfigAction;
    (function (ProjectConfigAction) {
        ProjectConfigAction[ProjectConfigAction["None"] = 0] = "None";
        ProjectConfigAction[ProjectConfigAction["CreateConfig"] = 1] = "CreateConfig";
        ProjectConfigAction[ProjectConfigAction["LearnMore"] = 2] = "LearnMore";
    })(ProjectConfigAction || (ProjectConfigAction = {}));
    const selected = await vscode.window.showInformationMessage((isTypeScriptProject
        ? localize(3, null, 'https://go.microsoft.com/fwlink/?linkid=841896')
        : localize(4, null, 'https://go.microsoft.com/fwlink/?linkid=759670')), {
        title: isTypeScriptProject
            ? localize(5, null)
            : localize(6, null),
        id: ProjectConfigAction.CreateConfig
    });
    switch (selected && selected.id) {
        case ProjectConfigAction.CreateConfig:
            tsconfig_1.openOrCreateConfigFile(isTypeScriptProject, rootPath, client.configuration);
            return;
    }
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/commands.js.map
