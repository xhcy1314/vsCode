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
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const vscode = require("vscode");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
function exists(file) {
    return new Promise((resolve, _reject) => {
        fs.exists(file, (value) => {
            resolve(value);
        });
    });
}
function exec(command, options) {
    return new Promise((resolve, reject) => {
        cp.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            }
            resolve({ stdout, stderr });
        });
    });
}
const buildNames = ['build', 'compile', 'watch'];
function isBuildTask(name) {
    for (let buildName of buildNames) {
        if (name.indexOf(buildName) !== -1) {
            return true;
        }
    }
    return false;
}
const testNames = ['test'];
function isTestTask(name) {
    for (let testName of testNames) {
        if (name.indexOf(testName) !== -1) {
            return true;
        }
    }
    return false;
}
let _channel;
function getOutputChannel() {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('Jake Auto Detection');
    }
    return _channel;
}
class FolderDetector {
    constructor(_workspaceFolder) {
        this._workspaceFolder = _workspaceFolder;
    }
    get workspaceFolder() {
        return this._workspaceFolder;
    }
    isEnabled() {
        return vscode.workspace.getConfiguration('jake', this._workspaceFolder.uri).get('autoDetect') === 'on';
    }
    start() {
        let pattern = path.join(this._workspaceFolder.uri.fsPath, '{Jakefile,Jakefile.js}');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.fileWatcher.onDidChange(() => this.promise = undefined);
        this.fileWatcher.onDidCreate(() => this.promise = undefined);
        this.fileWatcher.onDidDelete(() => this.promise = undefined);
    }
    getTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.promise) {
                this.promise = this.computeTasks();
            }
            return this.promise;
        });
    }
    computeTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            let rootPath = this._workspaceFolder.uri.scheme === 'file' ? this._workspaceFolder.uri.fsPath : undefined;
            let emptyTasks = [];
            if (!rootPath) {
                return emptyTasks;
            }
            let jakefile = path.join(rootPath, 'Jakefile');
            if (!(yield exists(jakefile))) {
                jakefile = path.join(rootPath, 'Jakefile.js');
                if (!(yield exists(jakefile))) {
                    return emptyTasks;
                }
            }
            let jakeCommand;
            let platform = process.platform;
            if (platform === 'win32' && (yield exists(path.join(rootPath, 'node_modules', '.bin', 'jake.cmd')))) {
                jakeCommand = path.join('.', 'node_modules', '.bin', 'jake.cmd');
            }
            else if ((platform === 'linux' || platform === 'darwin') && (yield exists(path.join(rootPath, 'node_modules', '.bin', 'jake')))) {
                jakeCommand = path.join('.', 'node_modules', '.bin', 'jake');
            }
            else {
                jakeCommand = 'jake';
            }
            let commandLine = `${jakeCommand} --tasks`;
            try {
                let { stdout, stderr } = yield exec(commandLine, { cwd: rootPath });
                if (stderr) {
                    getOutputChannel().appendLine(stderr);
                    getOutputChannel().show(true);
                }
                let result = [];
                if (stdout) {
                    let lines = stdout.split(/\r{0,1}\n/);
                    for (let line of lines) {
                        if (line.length === 0) {
                            continue;
                        }
                        let regExp = /^jake\s+([^\s]+)\s/g;
                        let matches = regExp.exec(line);
                        if (matches && matches.length === 2) {
                            let taskName = matches[1];
                            let kind = {
                                type: 'jake',
                                task: taskName
                            };
                            let options = { cwd: this.workspaceFolder.uri.fsPath };
                            let task = new vscode.Task(kind, taskName, 'jake', new vscode.ShellExecution(`${jakeCommand} ${taskName}`, options));
                            result.push(task);
                            let lowerCaseLine = line.toLowerCase();
                            if (isBuildTask(lowerCaseLine)) {
                                task.group = vscode.TaskGroup.Build;
                            }
                            else if (isTestTask(lowerCaseLine)) {
                                task.group = vscode.TaskGroup.Test;
                            }
                        }
                    }
                }
                return result;
            }
            catch (err) {
                let channel = getOutputChannel();
                if (err.stderr) {
                    channel.appendLine(err.stderr);
                }
                if (err.stdout) {
                    channel.appendLine(err.stdout);
                }
                channel.appendLine(localize(0, null, this.workspaceFolder.name, err.error ? err.error.toString() : 'unknown'));
                channel.show(true);
                return emptyTasks;
            }
        });
    }
    dispose() {
        this.promise = undefined;
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
}
class TaskDetector {
    constructor() {
        this.detectors = new Map();
    }
    start() {
        let folders = vscode.workspace.workspaceFolders;
        if (folders) {
            this.updateWorkspaceFolders(folders, []);
        }
        vscode.workspace.onDidChangeWorkspaceFolders((event) => this.updateWorkspaceFolders(event.added, event.removed));
        vscode.workspace.onDidChangeConfiguration(this.updateConfiguration, this);
    }
    dispose() {
        if (this.taskProvider) {
            this.taskProvider.dispose();
            this.taskProvider = undefined;
        }
        this.detectors.clear();
    }
    updateWorkspaceFolders(added, removed) {
        for (let remove of removed) {
            let detector = this.detectors.get(remove.uri.toString());
            if (detector) {
                detector.dispose();
                this.detectors.delete(remove.uri.toString());
            }
        }
        for (let add of added) {
            let detector = new FolderDetector(add);
            if (detector.isEnabled()) {
                this.detectors.set(add.uri.toString(), detector);
                detector.start();
            }
        }
        this.updateProvider();
    }
    updateConfiguration() {
        for (let detector of this.detectors.values()) {
            if (!detector.isEnabled()) {
                detector.dispose();
                this.detectors.delete(detector.workspaceFolder.uri.toString());
            }
        }
        let folders = vscode.workspace.workspaceFolders;
        if (folders) {
            for (let folder of folders) {
                if (!this.detectors.has(folder.uri.toString())) {
                    let detector = new FolderDetector(folder);
                    if (detector.isEnabled()) {
                        this.detectors.set(folder.uri.toString(), detector);
                        detector.start();
                    }
                }
            }
        }
        this.updateProvider();
    }
    updateProvider() {
        if (!this.taskProvider && this.detectors.size > 0) {
            this.taskProvider = vscode.workspace.registerTaskProvider('gulp', {
                provideTasks: () => {
                    return this.getTasks();
                },
                resolveTask(_task) {
                    return undefined;
                }
            });
        }
        else if (this.taskProvider && this.detectors.size === 0) {
            this.taskProvider.dispose();
            this.taskProvider = undefined;
        }
    }
    getTasks() {
        return this.computeTasks();
    }
    computeTasks() {
        if (this.detectors.size === 0) {
            return Promise.resolve([]);
        }
        else if (this.detectors.size === 1) {
            return this.detectors.values().next().value.getTasks();
        }
        else {
            let promises = [];
            for (let detector of this.detectors.values()) {
                promises.push(detector.getTasks().then((value) => value, () => []));
            }
            return Promise.all(promises).then((values) => {
                let result = [];
                for (let tasks of values) {
                    if (tasks && tasks.length > 0) {
                        result.push(...tasks);
                    }
                }
                return result;
            });
        }
    }
}
let detector;
function activate(_context) {
    detector = new TaskDetector();
    detector.start();
}
exports.activate = activate;
function deactivate() {
    detector.dispose();
}
exports.deactivate = deactivate;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\jake\out/main.js.map
