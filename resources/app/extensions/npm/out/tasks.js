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
const vscode_1 = require("vscode");
const path = require("path");
const fs = require("fs");
const minimatch = require("minimatch");
const nls = require("vscode-nls");
const main_1 = require("jsonc-parser/lib/main");
const localize = nls.loadMessageBundle(__filename);
let cachedTasks = undefined;
function invalidateScriptsCache() {
    cachedTasks = undefined;
}
exports.invalidateScriptsCache = invalidateScriptsCache;
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
        if (name === testName) {
            return true;
        }
    }
    return false;
}
function getPrePostScripts(scripts) {
    const prePostScripts = new Set([
        'preuninstall', 'postuninstall', 'prepack', 'postpack', 'preinstall', 'postinstall',
        'prepack', 'postpack', 'prepublish', 'postpublish', 'preversion', 'postversion',
        'prestop', 'poststop', 'prerestart', 'postrestart', 'preshrinkwrap', 'postshrinkwrap',
        'pretest', 'postest', 'prepublishOnly'
    ]);
    let keys = Object.keys(scripts);
    for (let i = 0; i < keys.length; i++) {
        const script = keys[i];
        const prepost = ['pre' + script, 'post' + script];
        prepost.forEach(each => {
            if (scripts[each] !== undefined) {
                prePostScripts.add(each);
            }
        });
    }
    return prePostScripts;
}
function isWorkspaceFolder(value) {
    return value && typeof value !== 'number';
}
exports.isWorkspaceFolder = isWorkspaceFolder;
function getPackageManager(folder) {
    return vscode_1.workspace.getConfiguration('npm', folder.uri).get('packageManager', 'npm');
}
exports.getPackageManager = getPackageManager;
function hasNpmScripts() {
    return __awaiter(this, void 0, void 0, function* () {
        let folders = vscode_1.workspace.workspaceFolders;
        if (!folders) {
            return false;
        }
        try {
            for (let i = 0; i < folders.length; i++) {
                let folder = folders[i];
                if (isAutoDetectionEnabled(folder)) {
                    let relativePattern = new vscode_1.RelativePattern(folder, '**/package.json');
                    let paths = yield vscode_1.workspace.findFiles(relativePattern, '**/node_modules/**');
                    if (paths.length > 0) {
                        return true;
                    }
                }
            }
            return false;
        }
        catch (error) {
            return Promise.reject(error);
        }
    });
}
exports.hasNpmScripts = hasNpmScripts;
function detectNpmScripts() {
    return __awaiter(this, void 0, void 0, function* () {
        let emptyTasks = [];
        let allTasks = [];
        let folders = vscode_1.workspace.workspaceFolders;
        if (!folders) {
            return emptyTasks;
        }
        try {
            for (let i = 0; i < folders.length; i++) {
                let folder = folders[i];
                if (isAutoDetectionEnabled(folder)) {
                    let relativePattern = new vscode_1.RelativePattern(folder, '**/package.json');
                    let paths = yield vscode_1.workspace.findFiles(relativePattern, '**/node_modules/**');
                    for (let j = 0; j < paths.length; j++) {
                        if (!isExcluded(folder, paths[j])) {
                            let tasks = yield provideNpmScriptsForFolder(paths[j]);
                            allTasks.push(...tasks);
                        }
                    }
                }
            }
            return allTasks;
        }
        catch (error) {
            return Promise.reject(error);
        }
    });
}
function provideNpmScripts() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cachedTasks) {
            cachedTasks = yield detectNpmScripts();
        }
        return cachedTasks;
    });
}
exports.provideNpmScripts = provideNpmScripts;
function isAutoDetectionEnabled(folder) {
    return vscode_1.workspace.getConfiguration('npm', folder.uri).get('autoDetect') === 'on';
}
function isExcluded(folder, packageJsonUri) {
    function testForExclusionPattern(path, pattern) {
        return minimatch(path, pattern, { dot: true });
    }
    let exclude = vscode_1.workspace.getConfiguration('npm', folder.uri).get('exclude');
    let packageJsonFolder = path.dirname(packageJsonUri.fsPath);
    if (exclude) {
        if (Array.isArray(exclude)) {
            for (let pattern of exclude) {
                if (testForExclusionPattern(packageJsonFolder, pattern)) {
                    return true;
                }
            }
        }
        else if (testForExclusionPattern(packageJsonFolder, exclude)) {
            return true;
        }
    }
    return false;
}
function isDebugScript(script) {
    let match = script.match(/--(inspect|debug)(-brk)?(=(\d*))?/);
    return match !== null;
}
function provideNpmScriptsForFolder(packageJsonUri) {
    return __awaiter(this, void 0, void 0, function* () {
        let emptyTasks = [];
        let folder = vscode_1.workspace.getWorkspaceFolder(packageJsonUri);
        if (!folder) {
            return emptyTasks;
        }
        let scripts = yield getScripts(packageJsonUri);
        if (!scripts) {
            return emptyTasks;
        }
        const result = [];
        const prePostScripts = getPrePostScripts(scripts);
        Object.keys(scripts).forEach(each => {
            const task = createTask(each, `run ${each}`, folder, packageJsonUri);
            const lowerCaseTaskName = each.toLowerCase();
            if (isBuildTask(lowerCaseTaskName)) {
                task.group = vscode_1.TaskGroup.Build;
            }
            else if (isTestTask(lowerCaseTaskName)) {
                task.group = vscode_1.TaskGroup.Test;
            }
            if (prePostScripts.has(each)) {
                task.group = vscode_1.TaskGroup.Clean; // hack: use Clean group to tag pre/post scripts
            }
            if (isDebugScript(scripts[each])) {
                task.group = vscode_1.TaskGroup.Rebuild; // hack: use Rebuild group to tag debug scripts
            }
            result.push(task);
        });
        // always add npm install (without a problem matcher)
        result.push(createTask('install', 'install', folder, packageJsonUri, []));
        return result;
    });
}
function getTaskName(script, relativePath) {
    if (relativePath && relativePath.length) {
        return `${script} - ${relativePath.substring(0, relativePath.length - 1)}`;
    }
    return script;
}
exports.getTaskName = getTaskName;
function createTask(script, cmd, folder, packageJsonUri, matcher) {
    function getCommandLine(folder, cmd) {
        let packageManager = getPackageManager(folder);
        if (vscode_1.workspace.getConfiguration('npm', folder.uri).get('runSilent')) {
            return `${packageManager} --silent ${cmd}`;
        }
        return `${packageManager} ${cmd}`;
    }
    function getRelativePath(folder, packageJsonUri) {
        let rootUri = folder.uri;
        let absolutePath = packageJsonUri.path.substring(0, packageJsonUri.path.length - 'package.json'.length);
        return absolutePath.substring(rootUri.path.length + 1);
    }
    let kind = {
        type: 'npm',
        script: script
    };
    let relativePackageJson = getRelativePath(folder, packageJsonUri);
    if (relativePackageJson.length) {
        kind.path = getRelativePath(folder, packageJsonUri);
    }
    let taskName = getTaskName(script, relativePackageJson);
    let cwd = path.dirname(packageJsonUri.fsPath);
    return new vscode_1.Task(kind, folder, taskName, 'npm', new vscode_1.ShellExecution(getCommandLine(folder, cmd), { cwd: cwd }), matcher);
}
exports.createTask = createTask;
function getPackageJsonUriFromTask(task) {
    if (isWorkspaceFolder(task.scope)) {
        if (task.definition.path) {
            return vscode_1.Uri.file(path.join(task.scope.uri.fsPath, task.definition.path, 'package.json'));
        }
        else {
            return vscode_1.Uri.file(path.join(task.scope.uri.fsPath, 'package.json'));
        }
    }
    return null;
}
exports.getPackageJsonUriFromTask = getPackageJsonUriFromTask;
function exists(file) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, _reject) => {
            fs.exists(file, (value) => {
                resolve(value);
            });
        });
    });
}
function readFile(file) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.readFile(file, (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(data.toString());
            });
        });
    });
}
function findAllScripts(buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        var scripts = {};
        let script = undefined;
        let inScripts = false;
        let visitor = {
            onError(_error, _offset, _length) {
                // TODO: inform user about the parse error
            },
            onObjectEnd() {
                if (inScripts) {
                    inScripts = false;
                }
            },
            onLiteralValue(value, _offset, _length) {
                if (script) {
                    scripts[script] = value;
                    script = undefined;
                }
            },
            onObjectProperty(property, _offset, _length) {
                if (property === 'scripts') {
                    inScripts = true;
                }
                else if (inScripts) {
                    script = property;
                }
            }
        };
        main_1.visit(buffer, visitor);
        return scripts;
    });
}
function getScripts(packageJsonUri) {
    return __awaiter(this, void 0, void 0, function* () {
        if (packageJsonUri.scheme !== 'file') {
            return undefined;
        }
        let packageJson = packageJsonUri.fsPath;
        if (!(yield exists(packageJson))) {
            return undefined;
        }
        try {
            var contents = yield readFile(packageJson);
            var json = findAllScripts(contents); //JSON.parse(contents);
            return json;
        }
        catch (e) {
            let localizedParseError = localize(0, null, packageJsonUri.fsPath);
            throw new Error(localizedParseError);
        }
    });
}
exports.getScripts = getScripts;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\npm\out/tasks.js.map
