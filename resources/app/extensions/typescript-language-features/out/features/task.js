/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const tsconfigProvider_1 = require("../utils/tsconfigProvider");
const tsconfig_1 = require("../utils/tsconfig");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
const exists = (file) => new Promise((resolve, _reject) => {
    fs.exists(file, (value) => {
        resolve(value);
    });
});
/**
 * Provides tasks for building `tsconfig.json` files in a project.
 */
class TscTaskProvider {
    constructor(client) {
        this.client = client;
        this.autoDetect = 'on';
        this.disposables = [];
        this.tsconfigProvider = new tsconfigProvider_1.default();
        vscode.workspace.onDidChangeConfiguration(this.onConfigurationChanged, this, this.disposables);
        this.onConfigurationChanged();
    }
    dispose() {
        this.disposables.forEach(x => x.dispose());
    }
    async provideTasks(token) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || !folders.length) {
            return [];
        }
        const configPaths = new Set();
        const tasks = [];
        for (const project of await this.getAllTsConfigs(token)) {
            if (!configPaths.has(project.path)) {
                configPaths.add(project.path);
                tasks.push(...(await this.getTasksForProject(project)));
            }
        }
        return tasks;
    }
    resolveTask(_task) {
        return undefined;
    }
    async getAllTsConfigs(token) {
        const out = new Set();
        const configs = (await this.getTsConfigForActiveFile(token)).concat(await this.getTsConfigsInWorkspace());
        for (const config of configs) {
            if (await exists(config.path)) {
                out.add(config);
            }
        }
        return Array.from(out);
    }
    async getTsConfigForActiveFile(token) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (path.basename(editor.document.fileName).match(/^tsconfig\.(.\.)?json$/)) {
                const uri = editor.document.uri;
                return [{
                        path: uri.fsPath,
                        workspaceFolder: vscode.workspace.getWorkspaceFolder(uri)
                    }];
            }
        }
        const file = this.getActiveTypeScriptFile();
        if (!file) {
            return [];
        }
        try {
            const res = await this.client.value.execute('projectInfo', { file, needFileNameList: false }, token);
            if (!res || !res.body) {
                return [];
            }
            const { configFileName } = res.body;
            if (configFileName && !tsconfig_1.isImplicitProjectConfigFile(configFileName)) {
                const normalizedConfigPath = path.normalize(configFileName);
                const uri = vscode.Uri.file(normalizedConfigPath);
                const folder = vscode.workspace.getWorkspaceFolder(uri);
                return [{
                        path: normalizedConfigPath,
                        workspaceFolder: folder
                    }];
            }
        }
        catch (e) {
            // noop
        }
        return [];
    }
    async getTsConfigsInWorkspace() {
        return Array.from(await this.tsconfigProvider.getConfigsForWorkspace());
    }
    static async getCommand(project) {
        if (project.workspaceFolder) {
            const localTsc = await TscTaskProvider.getLocalTscAtPath(path.dirname(project.path));
            if (localTsc) {
                return localTsc;
            }
            const workspaceTsc = await TscTaskProvider.getLocalTscAtPath(project.workspaceFolder.uri.fsPath);
            if (workspaceTsc) {
                return workspaceTsc;
            }
        }
        // Use global tsc version
        return 'tsc';
    }
    static async getLocalTscAtPath(folderPath) {
        const platform = process.platform;
        const bin = path.join(folderPath, 'node_modules', '.bin');
        if (platform === 'win32' && await exists(path.join(bin, 'tsc.cmd'))) {
            return path.join(bin, 'tsc.cmd');
        }
        else if ((platform === 'linux' || platform === 'darwin') && await exists(path.join(bin, 'tsc'))) {
            return path.join(bin, 'tsc');
        }
        return undefined;
    }
    getActiveTypeScriptFile() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document && (document.languageId === 'typescript' || document.languageId === 'typescriptreact')) {
                return this.client.value.toPath(document.uri);
            }
        }
        return null;
    }
    async getTasksForProject(project) {
        const command = await TscTaskProvider.getCommand(project);
        const label = this.getLabelForTasks(project);
        const tasks = [];
        if (this.autoDetect === 'build' || this.autoDetect === 'on') {
            const buildTaskidentifier = { type: 'typescript', tsconfig: label };
            const buildTask = new vscode.Task(buildTaskidentifier, project.workspaceFolder || vscode.TaskScope.Workspace, localize(0, null, label), 'tsc', new vscode.ShellExecution(command, ['-p', project.path]), '$tsc');
            buildTask.group = vscode.TaskGroup.Build;
            buildTask.isBackground = false;
            tasks.push(buildTask);
        }
        if (this.autoDetect === 'watch' || this.autoDetect === 'on') {
            const watchTaskidentifier = { type: 'typescript', tsconfig: label, option: 'watch' };
            const watchTask = new vscode.Task(watchTaskidentifier, project.workspaceFolder || vscode.TaskScope.Workspace, localize(1, null, label), 'tsc', new vscode.ShellExecution(command, ['--watch', '-p', project.path]), '$tsc-watch');
            watchTask.group = vscode.TaskGroup.Build;
            watchTask.isBackground = true;
            tasks.push(watchTask);
        }
        return tasks;
    }
    getLabelForTasks(project) {
        if (project.workspaceFolder) {
            const projectFolder = project.workspaceFolder;
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const relativePath = path.relative(project.workspaceFolder.uri.fsPath, project.path);
            if (workspaceFolders && workspaceFolders.length > 1) {
                // Use absolute path when we have multiple folders with the same name
                if (workspaceFolders.filter(x => x.name === projectFolder.name).length > 1) {
                    return path.join(project.workspaceFolder.uri.fsPath, relativePath);
                }
                else {
                    return path.join(project.workspaceFolder.name, relativePath);
                }
            }
            else {
                return relativePath;
            }
        }
        return project.path;
    }
    onConfigurationChanged() {
        const type = vscode.workspace.getConfiguration('typescript.tsc').get('autoDetect');
        this.autoDetect = typeof type === 'undefined' ? 'on' : type;
    }
}
/**
 * Manages registrations of TypeScript task providers with VS Code.
 */
class TypeScriptTaskProviderManager {
    constructor(client) {
        this.client = client;
        this.taskProviderSub = undefined;
        this.disposables = [];
        vscode.workspace.onDidChangeConfiguration(this.onConfigurationChanged, this, this.disposables);
        this.onConfigurationChanged();
    }
    dispose() {
        if (this.taskProviderSub) {
            this.taskProviderSub.dispose();
            this.taskProviderSub = undefined;
        }
        this.disposables.forEach(x => x.dispose());
    }
    onConfigurationChanged() {
        const autoDetect = vscode.workspace.getConfiguration('typescript.tsc').get('autoDetect');
        if (this.taskProviderSub && autoDetect === 'off') {
            this.taskProviderSub.dispose();
            this.taskProviderSub = undefined;
        }
        else if (!this.taskProviderSub && autoDetect !== 'off') {
            this.taskProviderSub = vscode.workspace.registerTaskProvider('typescript', new TscTaskProvider(this.client));
        }
    }
}
exports.default = TypeScriptTaskProviderManager;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\task.js.map
