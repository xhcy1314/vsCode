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
        _channel = vscode.window.createOutputChannel('Gulp Auto Detection');
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
        return vscode.workspace.getConfiguration('grunt', this._workspaceFolder.uri).get('autoDetect') === 'on';
    }
    start() {
        let pattern = path.join(this._workspaceFolder.uri.fsPath, '[Gg]runtfile.js');
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
            if (!(yield exists(path.join(rootPath, 'gruntfile.js'))) && !(yield exists(path.join(rootPath, 'Gruntfile.js')))) {
                return emptyTasks;
            }
            let command;
            let platform = process.platform;
            if (platform === 'win32' && (yield exists(path.join(rootPath, 'node_modules', '.bin', 'grunt.cmd')))) {
                command = path.join('.', 'node_modules', '.bin', 'grunt.cmd');
            }
            else if ((platform === 'linux' || platform === 'darwin') && (yield exists(path.join(rootPath, 'node_modules', '.bin', 'grunt')))) {
                command = path.join('.', 'node_modules', '.bin', 'grunt');
            }
            else {
                command = 'grunt';
            }
            let commandLine = `${command} --help --no-color`;
            try {
                let { stdout, stderr } = yield exec(commandLine, { cwd: rootPath });
                if (stderr) {
                    getOutputChannel().appendLine(stderr);
                    getOutputChannel().show(true);
                }
                let result = [];
                if (stdout) {
                    // grunt lists tasks as follows (description is wrapped into a new line if too long):
                    // ...
                    // Available tasks
                    //         uglify  Minify files with UglifyJS. *
                    //         jshint  Validate files with JSHint. *
                    //           test  Alias for "jshint", "qunit" tasks.
                    //        default  Alias for "jshint", "qunit", "concat", "uglify" tasks.
                    //           long  Alias for "eslint", "qunit", "browserify", "sass",
                    //                 "autoprefixer", "uglify", tasks.
                    //
                    // Tasks run in the order specified
                    let lines = stdout.split(/\r{0,1}\n/);
                    let tasksStart = false;
                    let tasksEnd = false;
                    for (let line of lines) {
                        if (line.length === 0) {
                            continue;
                        }
                        if (!tasksStart && !tasksEnd) {
                            if (line.indexOf('Available tasks') === 0) {
                                tasksStart = true;
                            }
                        }
                        else if (tasksStart && !tasksEnd) {
                            if (line.indexOf('Tasks run in the order specified') === 0) {
                                tasksEnd = true;
                            }
                            else {
                                let regExp = /^\s*(\S.*\S)  \S/g;
                                let matches = regExp.exec(line);
                                if (matches && matches.length === 2) {
                                    let name = matches[1];
                                    let kind = {
                                        type: 'grunt',
                                        task: name
                                    };
                                    let source = 'grunt';
                                    let options = { cwd: this.workspaceFolder.uri.fsPath };
                                    let task = name.indexOf(' ') === -1
                                        ? new vscode.Task(kind, this.workspaceFolder, name, source, new vscode.ShellExecution(`${command} ${name}`, options))
                                        : new vscode.Task(kind, this.workspaceFolder, name, source, new vscode.ShellExecution(`${command} "${name}"`, options));
                                    result.push(task);
                                    let lowerCaseTaskName = name.toLowerCase();
                                    if (isBuildTask(lowerCaseTaskName)) {
                                        task.group = vscode.TaskGroup.Build;
                                    }
                                    else if (isTestTask(lowerCaseTaskName)) {
                                        task.group = vscode.TaskGroup.Test;
                                    }
                                }
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
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\grunt\out/main.js.map
