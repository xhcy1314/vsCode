/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const git_1 = require("./git");
const repository_1 = require("./repository");
const uri_1 = require("./uri");
const util_1 = require("./util");
const staging_1 = require("./staging");
const path = require("path");
const fs_1 = require("fs");
const os = require("os");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
class CheckoutItem {
    constructor(ref) {
        this.ref = ref;
    }
    get shortCommit() { return (this.ref.commit || '').substr(0, 8); }
    get treeish() { return this.ref.name; }
    get label() { return this.ref.name || this.shortCommit; }
    get description() { return this.shortCommit; }
    run(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const ref = this.treeish;
            if (!ref) {
                return;
            }
            yield repository.checkout(ref);
        });
    }
}
class CheckoutTagItem extends CheckoutItem {
    get description() {
        return localize(0, null, this.shortCommit);
    }
}
class CheckoutRemoteHeadItem extends CheckoutItem {
    get description() {
        return localize(1, null, this.shortCommit);
    }
    get treeish() {
        if (!this.ref.name) {
            return;
        }
        const match = /^[^/]+\/(.*)$/.exec(this.ref.name);
        return match ? match[1] : this.ref.name;
    }
}
class BranchDeleteItem {
    constructor(ref) {
        this.ref = ref;
    }
    get shortCommit() { return (this.ref.commit || '').substr(0, 8); }
    get branchName() { return this.ref.name; }
    get label() { return this.branchName || ''; }
    get description() { return this.shortCommit; }
    run(repository, force) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.branchName) {
                return;
            }
            yield repository.deleteBranch(this.branchName, force);
        });
    }
}
class MergeItem {
    constructor(ref) {
        this.ref = ref;
    }
    get label() { return this.ref.name || ''; }
    get description() { return this.ref.name || ''; }
    run(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield repository.merge(this.ref.name || this.ref.commit);
        });
    }
}
class CreateBranchItem {
    constructor(cc) {
        this.cc = cc;
    }
    get label() { return localize(2, null); }
    get description() { return ''; }
    run(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.cc.branch(repository);
        });
    }
}
const Commands = [];
function command(commandId, options = {}) {
    return (target, key, descriptor) => {
        if (!(typeof descriptor.value === 'function')) {
            throw new Error('not supported');
        }
        Commands.push({ commandId, key, method: descriptor.value, options });
    };
}
const ImageMimetypes = [
    'image/png',
    'image/gif',
    'image/jpeg',
    'image/webp',
    'image/tiff',
    'image/bmp'
];
class CommandCenter {
    constructor(git, model, outputChannel, telemetryReporter) {
        this.git = git;
        this.model = model;
        this.outputChannel = outputChannel;
        this.telemetryReporter = telemetryReporter;
        this.disposables = Commands.map(({ commandId, key, method, options }) => {
            const command = this.createCommand(commandId, key, method, options);
            if (options.diff) {
                return vscode_1.commands.registerDiffInformationCommand(commandId, command);
            }
            else {
                return vscode_1.commands.registerCommand(commandId, command);
            }
        });
    }
    refresh(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield repository.status();
        });
    }
    openResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._openResource(resource, undefined, true, false);
        });
    }
    _openResource(resource, preview, preserveFocus, preserveSelection) {
        return __awaiter(this, void 0, void 0, function* () {
            let stat;
            try {
                stat = yield new Promise((c, e) => fs_1.lstat(resource.resourceUri.fsPath, (err, stat) => err ? e(err) : c(stat)));
            }
            catch (err) {
                // noop
            }
            let left;
            let right;
            if (stat && stat.isDirectory()) {
                const repository = this.model.getRepositoryForSubmodule(resource.resourceUri);
                if (repository) {
                    right = uri_1.toGitUri(resource.resourceUri, resource.resourceGroupType === repository_1.ResourceGroupType.Index ? 'index' : 'wt', { submoduleOf: repository.root });
                }
            }
            else {
                left = yield this.getLeftResource(resource);
                right = yield this.getRightResource(resource);
            }
            const title = this.getTitle(resource);
            if (!right) {
                // TODO
                console.error('oh no');
                return;
            }
            const opts = {
                preserveFocus,
                preview,
                viewColumn: vscode_1.ViewColumn.Active
            };
            const activeTextEditor = vscode_1.window.activeTextEditor;
            // Check if active text editor has same path as other editor. we cannot compare via
            // URI.toString() here because the schemas can be different. Instead we just go by path.
            if (preserveSelection && activeTextEditor && activeTextEditor.document.uri.path === right.path) {
                opts.selection = activeTextEditor.selection;
            }
            if (!left) {
                yield vscode_1.commands.executeCommand('vscode.open', right, opts);
            }
            else {
                yield vscode_1.commands.executeCommand('vscode.diff', left, right, title, opts);
            }
        });
    }
    getURI(uri, ref) {
        return __awaiter(this, void 0, void 0, function* () {
            const repository = this.model.getRepository(uri);
            if (!repository) {
                return uri_1.toGitUri(uri, ref);
            }
            try {
                let gitRef = ref;
                if (gitRef === '~') {
                    const uriString = uri.toString();
                    const [indexStatus] = repository.indexGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString);
                    gitRef = indexStatus ? '' : 'HEAD';
                }
                const { size, object } = yield repository.lstree(gitRef, uri.fsPath);
                const { mimetype } = yield repository.detectObjectType(object);
                if (mimetype === 'text/plain') {
                    return uri_1.toGitUri(uri, ref);
                }
                if (size > 1000000) { // 1 MB
                    return vscode_1.Uri.parse(`data:;label:${path.basename(uri.fsPath)};description:${gitRef},`);
                }
                if (ImageMimetypes.indexOf(mimetype) > -1) {
                    const contents = yield repository.buffer(gitRef, uri.fsPath);
                    return vscode_1.Uri.parse(`data:${mimetype};label:${path.basename(uri.fsPath)};description:${gitRef};size:${size};base64,${contents.toString('base64')}`);
                }
                return vscode_1.Uri.parse(`data:;label:${path.basename(uri.fsPath)};description:${gitRef},`);
            }
            catch (err) {
                return uri_1.toGitUri(uri, ref);
            }
        });
    }
    getLeftResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (resource.type) {
                case repository_1.Status.INDEX_MODIFIED:
                case repository_1.Status.INDEX_RENAMED:
                    return this.getURI(resource.original, 'HEAD');
                case repository_1.Status.MODIFIED:
                    return this.getURI(resource.resourceUri, '~');
                case repository_1.Status.DELETED_BY_THEM:
                    return this.getURI(resource.resourceUri, '');
            }
        });
    }
    getRightResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (resource.type) {
                case repository_1.Status.INDEX_MODIFIED:
                case repository_1.Status.INDEX_ADDED:
                case repository_1.Status.INDEX_COPIED:
                case repository_1.Status.INDEX_RENAMED:
                    return this.getURI(resource.resourceUri, '');
                case repository_1.Status.INDEX_DELETED:
                case repository_1.Status.DELETED_BY_THEM:
                case repository_1.Status.DELETED:
                    return this.getURI(resource.resourceUri, 'HEAD');
                case repository_1.Status.MODIFIED:
                case repository_1.Status.UNTRACKED:
                case repository_1.Status.IGNORED:
                    const repository = this.model.getRepository(resource.resourceUri);
                    if (!repository) {
                        return;
                    }
                    const uriString = resource.resourceUri.toString();
                    const [indexStatus] = repository.indexGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString);
                    if (indexStatus && indexStatus.renameResourceUri) {
                        return indexStatus.renameResourceUri;
                    }
                    return resource.resourceUri;
                case repository_1.Status.BOTH_ADDED:
                case repository_1.Status.BOTH_MODIFIED:
                    return resource.resourceUri;
            }
        });
    }
    getTitle(resource) {
        const basename = path.basename(resource.resourceUri.fsPath);
        switch (resource.type) {
            case repository_1.Status.INDEX_MODIFIED:
            case repository_1.Status.INDEX_RENAMED:
            case repository_1.Status.DELETED_BY_THEM:
                return `${basename} (Index)`;
            case repository_1.Status.MODIFIED:
            case repository_1.Status.BOTH_ADDED:
            case repository_1.Status.BOTH_MODIFIED:
                return `${basename} (Working Tree)`;
        }
        return '';
    }
    clone(url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!url) {
                url = yield vscode_1.window.showInputBox({
                    prompt: localize(3, null),
                    ignoreFocusOut: true
                });
            }
            if (!url) {
                /* __GDPR__
                    "clone" : {
                        "outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                    }
                */
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_URL' });
                return;
            }
            const config = vscode_1.workspace.getConfiguration('git');
            let defaultCloneDirectory = config.get('defaultCloneDirectory') || os.homedir();
            defaultCloneDirectory = defaultCloneDirectory.replace(/^~/, os.homedir());
            const uris = yield vscode_1.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: vscode_1.Uri.file(defaultCloneDirectory),
                openLabel: localize(4, null)
            });
            if (!uris || uris.length === 0) {
                /* __GDPR__
                    "clone" : {
                        "outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                    }
                */
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_directory' });
                return;
            }
            const uri = uris[0];
            const parentPath = uri.fsPath;
            try {
                const opts = {
                    location: vscode_1.ProgressLocation.Notification,
                    title: localize(5, null, url),
                    cancellable: true
                };
                const repositoryPath = yield vscode_1.window.withProgress(opts, (_, token) => this.git.clone(url, parentPath, token));
                const choices = [];
                let message = localize(6, null);
                const open = localize(7, null);
                choices.push(open);
                const addToWorkspace = localize(8, null);
                if (vscode_1.workspace.workspaceFolders) {
                    message = localize(9, null);
                    choices.push(addToWorkspace);
                }
                const result = yield vscode_1.window.showInformationMessage(message, ...choices);
                const openFolder = result === open;
                /* __GDPR__
                    "clone" : {
                        "outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                        "openFolder": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true }
                    }
                */
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'success' }, { openFolder: openFolder ? 1 : 0 });
                const uri = vscode_1.Uri.file(repositoryPath);
                if (openFolder) {
                    vscode_1.commands.executeCommand('vscode.openFolder', uri);
                }
                else if (result === addToWorkspace) {
                    vscode_1.workspace.updateWorkspaceFolders(vscode_1.workspace.workspaceFolders.length, 0, { uri });
                }
            }
            catch (err) {
                if (/already exists and is not an empty directory/.test(err && err.stderr || '')) {
                    /* __GDPR__
                        "clone" : {
                            "outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                        }
                    */
                    this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'directory_not_empty' });
                }
                else if (/Cancelled/i.test(err && (err.message || err.stderr || ''))) {
                    return;
                }
                else {
                    /* __GDPR__
                        "clone" : {
                            "outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                        }
                    */
                    this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'error' });
                }
                throw err;
            }
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            let path;
            if (vscode_1.workspace.workspaceFolders && vscode_1.workspace.workspaceFolders.length > 1) {
                const placeHolder = localize(10, null);
                const items = vscode_1.workspace.workspaceFolders.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder }));
                const item = yield vscode_1.window.showQuickPick(items, { placeHolder, ignoreFocusOut: true });
                if (!item) {
                    return;
                }
                path = item.folder.uri.fsPath;
            }
            if (!path) {
                const homeUri = vscode_1.Uri.file(os.homedir());
                const defaultUri = vscode_1.workspace.workspaceFolders && vscode_1.workspace.workspaceFolders.length > 0
                    ? vscode_1.Uri.file(vscode_1.workspace.workspaceFolders[0].uri.fsPath)
                    : homeUri;
                const result = yield vscode_1.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    defaultUri,
                    openLabel: localize(11, null)
                });
                if (!result || result.length === 0) {
                    return;
                }
                const uri = result[0];
                if (homeUri.toString().startsWith(uri.toString())) {
                    const yes = localize(12, null);
                    const answer = yield vscode_1.window.showWarningMessage(localize(13, null, uri.fsPath), yes);
                    if (answer !== yes) {
                        return;
                    }
                }
                path = uri.fsPath;
            }
            yield this.git.init(path);
            yield this.model.tryOpenRepository(path);
        });
    }
    close(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            this.model.close(repository);
        });
    }
    openFile(arg, ...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            const preserveFocus = arg instanceof repository_1.Resource;
            let uris;
            if (arg instanceof vscode_1.Uri) {
                if (arg.scheme === 'git') {
                    uris = [vscode_1.Uri.file(uri_1.fromGitUri(arg).path)];
                }
                else if (arg.scheme === 'file') {
                    uris = [arg];
                }
            }
            else {
                let resource = arg;
                if (!(resource instanceof repository_1.Resource)) {
                    // can happen when called from a keybinding
                    resource = this.getSCMResource();
                }
                if (resource) {
                    const resources = [resource, ...resourceStates]
                        .filter(r => r.type !== repository_1.Status.DELETED && r.type !== repository_1.Status.INDEX_DELETED);
                    uris = resources.map(r => r.resourceUri);
                }
            }
            if (!uris) {
                return;
            }
            const preview = uris.length === 1 ? true : false;
            const activeTextEditor = vscode_1.window.activeTextEditor;
            for (const uri of uris) {
                const opts = {
                    preserveFocus,
                    preview,
                    viewColumn: vscode_1.ViewColumn.Active
                };
                // Check if active text editor has same path as other editor. we cannot compare via
                // URI.toString() here because the schemas can be different. Instead we just go by path.
                if (activeTextEditor && activeTextEditor.document.uri.path === uri.path) {
                    opts.selection = activeTextEditor.selection;
                }
                yield vscode_1.commands.executeCommand('vscode.open', uri, opts);
            }
        });
    }
    openFile2(arg, ...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            this.openFile(arg, ...resourceStates);
        });
    }
    openHEADFile(arg) {
        return __awaiter(this, void 0, void 0, function* () {
            let resource = undefined;
            if (arg instanceof repository_1.Resource) {
                resource = arg;
            }
            else if (arg instanceof vscode_1.Uri) {
                resource = this.getSCMResource(arg);
            }
            else {
                resource = this.getSCMResource();
            }
            if (!resource) {
                return;
            }
            const HEAD = yield this.getLeftResource(resource);
            if (!HEAD) {
                vscode_1.window.showWarningMessage(localize(14, null, path.basename(resource.resourceUri.fsPath)));
                return;
            }
            return yield vscode_1.commands.executeCommand('vscode.open', HEAD);
        });
    }
    openChange(arg, ...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            const preserveFocus = arg instanceof repository_1.Resource;
            const preserveSelection = arg instanceof vscode_1.Uri || !arg;
            let resources = undefined;
            if (arg instanceof vscode_1.Uri) {
                const resource = this.getSCMResource(arg);
                if (resource !== undefined) {
                    resources = [resource];
                }
            }
            else {
                let resource = undefined;
                if (arg instanceof repository_1.Resource) {
                    resource = arg;
                }
                else {
                    resource = this.getSCMResource();
                }
                if (resource) {
                    resources = [...resourceStates, resource];
                }
            }
            if (!resources) {
                return;
            }
            const preview = resources.length === 1 ? undefined : false;
            for (const resource of resources) {
                yield this._openResource(resource, preview, preserveFocus, preserveSelection);
            }
        });
    }
    stage(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            this.outputChannel.appendLine(`git.stage ${resourceStates.length}`);
            resourceStates = resourceStates.filter(s => !!s);
            if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof vscode_1.Uri))) {
                const resource = this.getSCMResource();
                this.outputChannel.appendLine(`git.stage.getSCMResource ${resource ? resource.resourceUri.toString() : null}`);
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const selection = resourceStates.filter(s => s instanceof repository_1.Resource);
            const merge = selection.filter(s => s.resourceGroupType === repository_1.ResourceGroupType.Merge);
            const bothModified = merge.filter(s => s.type === repository_1.Status.BOTH_MODIFIED);
            const promises = bothModified.map(s => util_1.grep(s.resourceUri.fsPath, /^<{7}|^={7}|^>{7}/));
            const unresolvedBothModified = yield Promise.all(promises);
            const resolvedConflicts = bothModified.filter((s, i) => !unresolvedBothModified[i]);
            const unresolvedConflicts = [
                ...merge.filter(s => s.type !== repository_1.Status.BOTH_MODIFIED),
                ...bothModified.filter((s, i) => unresolvedBothModified[i])
            ];
            if (unresolvedConflicts.length > 0) {
                const message = unresolvedConflicts.length > 1
                    ? localize(15, null, unresolvedConflicts.length)
                    : localize(16, null, path.basename(unresolvedConflicts[0].resourceUri.fsPath));
                const yes = localize(17, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
            }
            const workingTree = selection.filter(s => s.resourceGroupType === repository_1.ResourceGroupType.WorkingTree);
            const scmResources = [...workingTree, ...resolvedConflicts, ...unresolvedConflicts];
            this.outputChannel.appendLine(`git.stage.scmResources ${scmResources.length}`);
            if (!scmResources.length) {
                return;
            }
            const resources = scmResources.map(r => r.resourceUri);
            yield this.runByRepository(resources, (repository, resources) => __awaiter(this, void 0, void 0, function* () { return repository.add(resources); }));
        });
    }
    stageAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const resources = repository.mergeGroup.resourceStates.filter(s => s instanceof repository_1.Resource);
            const mergeConflicts = resources.filter(s => s.resourceGroupType === repository_1.ResourceGroupType.Merge);
            if (mergeConflicts.length > 0) {
                const message = mergeConflicts.length > 1
                    ? localize(18, null, mergeConflicts.length)
                    : localize(19, null, path.basename(mergeConflicts[0].resourceUri.fsPath));
                const yes = localize(20, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
            }
            yield repository.add([]);
        });
    }
    stageChange(uri, changes, index) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.visibleTextEditors.filter(e => e.document.uri.toString() === uri.toString())[0];
            if (!textEditor) {
                return;
            }
            yield this._stageChanges(textEditor, [changes[index]]);
        });
    }
    stageSelectedChanges(changes) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const selectedLines = staging_1.toLineRanges(textEditor.selections, modifiedDocument);
            const selectedChanges = changes
                .map(diff => selectedLines.reduce((result, range) => result || staging_1.intersectDiffWithRange(modifiedDocument, diff, range), null))
                .filter(d => !!d);
            if (!selectedChanges.length) {
                return;
            }
            yield this._stageChanges(textEditor, selectedChanges);
        });
    }
    _stageChanges(textEditor, changes) {
        return __awaiter(this, void 0, void 0, function* () {
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'file') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, '~');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const result = staging_1.applyLineChanges(originalDocument, modifiedDocument, changes);
            yield this.runByRepository(modifiedUri, (repository, resource) => __awaiter(this, void 0, void 0, function* () { return yield repository.stage(resource, result); }));
        });
    }
    revertChange(uri, changes, index) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.visibleTextEditors.filter(e => e.document.uri.toString() === uri.toString())[0];
            if (!textEditor) {
                return;
            }
            yield this._revertChanges(textEditor, [...changes.slice(0, index), ...changes.slice(index + 1)]);
        });
    }
    revertSelectedRanges(changes) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const selections = textEditor.selections;
            const selectedChanges = changes.filter(change => {
                const modifiedRange = staging_1.getModifiedRange(modifiedDocument, change);
                return selections.every(selection => !selection.intersection(modifiedRange));
            });
            if (selectedChanges.length === changes.length) {
                return;
            }
            yield this._revertChanges(textEditor, selectedChanges);
        });
    }
    _revertChanges(textEditor, changes) {
        return __awaiter(this, void 0, void 0, function* () {
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'file') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, '~');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const result = staging_1.applyLineChanges(originalDocument, modifiedDocument, changes);
            const edit = new vscode_1.WorkspaceEdit();
            edit.replace(modifiedUri, new vscode_1.Range(new vscode_1.Position(0, 0), modifiedDocument.lineAt(modifiedDocument.lineCount - 1).range.end), result);
            vscode_1.workspace.applyEdit(edit);
            yield modifiedDocument.save();
        });
    }
    unstage(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            resourceStates = resourceStates.filter(s => !!s);
            if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof vscode_1.Uri))) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const scmResources = resourceStates
                .filter(s => s instanceof repository_1.Resource && s.resourceGroupType === repository_1.ResourceGroupType.Index);
            if (!scmResources.length) {
                return;
            }
            const resources = scmResources.map(r => r.resourceUri);
            yield this.runByRepository(resources, (repository, resources) => __awaiter(this, void 0, void 0, function* () { return repository.revert(resources); }));
        });
    }
    unstageAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield repository.revert([]);
        });
    }
    unstageSelectedRanges(diffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'git') {
                return;
            }
            const { ref } = uri_1.fromGitUri(modifiedUri);
            if (ref !== '') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, 'HEAD');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const selectedLines = staging_1.toLineRanges(textEditor.selections, modifiedDocument);
            const selectedDiffs = diffs
                .map(diff => selectedLines.reduce((result, range) => result || staging_1.intersectDiffWithRange(modifiedDocument, diff, range), null))
                .filter(d => !!d);
            if (!selectedDiffs.length) {
                return;
            }
            const invertedDiffs = selectedDiffs.map(staging_1.invertLineChange);
            const result = staging_1.applyLineChanges(modifiedDocument, originalDocument, invertedDiffs);
            yield this.runByRepository(modifiedUri, (repository, resource) => __awaiter(this, void 0, void 0, function* () { return yield repository.stage(resource, result); }));
        });
    }
    clean(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            resourceStates = resourceStates.filter(s => !!s);
            if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof vscode_1.Uri))) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const scmResources = resourceStates
                .filter(s => s instanceof repository_1.Resource && s.resourceGroupType === repository_1.ResourceGroupType.WorkingTree);
            if (!scmResources.length) {
                return;
            }
            const untrackedCount = scmResources.reduce((s, r) => s + (r.type === repository_1.Status.UNTRACKED ? 1 : 0), 0);
            let message;
            let yes = localize(21, null);
            if (scmResources.length === 1) {
                if (untrackedCount > 0) {
                    message = localize(22, null, path.basename(scmResources[0].resourceUri.fsPath));
                    yes = localize(23, null);
                }
                else {
                    message = localize(24, null, path.basename(scmResources[0].resourceUri.fsPath));
                }
            }
            else {
                message = localize(25, null, scmResources.length);
                if (untrackedCount > 0) {
                    message = `${message}\n\n${localize(26, null, untrackedCount)}`;
                }
            }
            const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
            if (pick !== yes) {
                return;
            }
            const resources = scmResources.map(r => r.resourceUri);
            yield this.runByRepository(resources, (repository, resources) => __awaiter(this, void 0, void 0, function* () { return repository.clean(resources); }));
        });
    }
    cleanAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            let resources = repository.workingTreeGroup.resourceStates;
            if (resources.length === 0) {
                return;
            }
            const trackedResources = resources.filter(r => r.type !== repository_1.Status.UNTRACKED && r.type !== repository_1.Status.IGNORED);
            const untrackedResources = resources.filter(r => r.type === repository_1.Status.UNTRACKED || r.type === repository_1.Status.IGNORED);
            if (untrackedResources.length === 0) {
                const message = resources.length === 1
                    ? localize(27, null, path.basename(resources[0].resourceUri.fsPath))
                    : localize(28, null, resources.length);
                const yes = resources.length === 1
                    ? localize(29, null)
                    : localize(30, null, resources.length);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
                return;
            }
            else if (resources.length === 1) {
                const message = localize(31, null, path.basename(resources[0].resourceUri.fsPath));
                const yes = localize(32, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
            }
            else if (trackedResources.length === 0) {
                const message = localize(33, null, resources.length);
                const yes = localize(34, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
            }
            else { // resources.length > 1 && untrackedResources.length > 0 && trackedResources.length > 0
                const untrackedMessage = untrackedResources.length === 1
                    ? localize(35, null, path.basename(untrackedResources[0].resourceUri.fsPath))
                    : localize(36, null, untrackedResources.length);
                const message = localize(37, null, untrackedMessage, resources.length);
                const yesTracked = trackedResources.length === 1
                    ? localize(38, null, trackedResources.length)
                    : localize(39, null, trackedResources.length);
                const yesAll = localize(40, null, resources.length);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yesTracked, yesAll);
                if (pick === yesTracked) {
                    resources = trackedResources;
                }
                else if (pick !== yesAll) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
            }
        });
    }
    smartCommit(repository, getCommitMessage, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode_1.workspace.getConfiguration('git');
            const promptToSaveFilesBeforeCommit = config.get('promptToSaveFilesBeforeCommit') === true;
            if (promptToSaveFilesBeforeCommit) {
                const unsavedTextDocuments = vscode_1.workspace.textDocuments
                    .filter(d => !d.isUntitled && d.isDirty && util_1.isDescendant(repository.root, d.uri.fsPath));
                if (unsavedTextDocuments.length > 0) {
                    const message = unsavedTextDocuments.length === 1
                        ? localize(41, null, path.basename(unsavedTextDocuments[0].uri.fsPath))
                        : localize(42, null, unsavedTextDocuments.length);
                    const saveAndCommit = localize(43, null);
                    const commit = localize(44, null);
                    const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, saveAndCommit, commit);
                    if (pick === saveAndCommit) {
                        yield Promise.all(unsavedTextDocuments.map(d => d.save()));
                        yield repository.status();
                    }
                    else if (pick !== commit) {
                        return false; // do not commit on cancel
                    }
                }
            }
            const enableSmartCommit = config.get('enableSmartCommit') === true;
            const enableCommitSigning = config.get('enableCommitSigning') === true;
            const noStagedChanges = repository.indexGroup.resourceStates.length === 0;
            const noUnstagedChanges = repository.workingTreeGroup.resourceStates.length === 0;
            // no changes, and the user has not configured to commit all in this case
            if (!noUnstagedChanges && noStagedChanges && !enableSmartCommit) {
                // prompt the user if we want to commit all or not
                const message = localize(45, null);
                const yes = localize(46, null);
                const always = localize(47, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes, always);
                if (pick === always) {
                    config.update('enableSmartCommit', true, true);
                }
                else if (pick !== yes) {
                    return false; // do not commit on cancel
                }
            }
            if (!opts) {
                opts = { all: noStagedChanges };
            }
            else if (!opts.all && noStagedChanges) {
                opts = Object.assign({}, opts, { all: true });
            }
            // enable signing of commits if configurated
            opts.signCommit = enableCommitSigning;
            if (
            // no changes
            (noStagedChanges && noUnstagedChanges)
                // or no staged changes and not `all`
                || (!opts.all && noStagedChanges)) {
                vscode_1.window.showInformationMessage(localize(48, null));
                return false;
            }
            const message = yield getCommitMessage();
            if (!message) {
                return false;
            }
            yield repository.commit(message, opts);
            return true;
        });
    }
    commitWithAnyInput(repository, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = repository.inputBox.value;
            const getCommitMessage = () => __awaiter(this, void 0, void 0, function* () {
                if (message) {
                    return message;
                }
                let value = undefined;
                if (opts && opts.amend && repository.HEAD && repository.HEAD.commit) {
                    value = (yield repository.getCommit(repository.HEAD.commit)).message;
                }
                return yield vscode_1.window.showInputBox({
                    value,
                    placeHolder: localize(49, null),
                    prompt: localize(50, null),
                    ignoreFocusOut: true
                });
            });
            const didCommit = yield this.smartCommit(repository, getCommitMessage, opts);
            if (message && didCommit) {
                repository.inputBox.value = yield repository.getCommitTemplate();
            }
        });
    }
    commit(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository);
        });
    }
    commitWithInput(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!repository.inputBox.value) {
                return;
            }
            const didCommit = yield this.smartCommit(repository, () => __awaiter(this, void 0, void 0, function* () { return repository.inputBox.value; }));
            if (didCommit) {
                repository.inputBox.value = yield repository.getCommitTemplate();
            }
        });
    }
    commitStaged(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: false });
        });
    }
    commitStagedSigned(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: false, signoff: true });
        });
    }
    commitStagedAmend(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: false, amend: true });
        });
    }
    commitAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: true });
        });
    }
    commitAllSigned(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: true, signoff: true });
        });
    }
    commitAllAmend(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: true, amend: true });
        });
    }
    undoCommit(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const HEAD = repository.HEAD;
            if (!HEAD || !HEAD.commit) {
                return;
            }
            const commit = yield repository.getCommit('HEAD');
            yield repository.reset('HEAD~');
            repository.inputBox.value = commit.message;
        });
    }
    checkout(repository, treeish) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof treeish === 'string') {
                return yield repository.checkout(treeish);
            }
            const config = vscode_1.workspace.getConfiguration('git');
            const checkoutType = config.get('checkoutType') || 'all';
            const includeTags = checkoutType === 'all' || checkoutType === 'tags';
            const includeRemotes = checkoutType === 'all' || checkoutType === 'remote';
            const createBranch = new CreateBranchItem(this);
            const heads = repository.refs.filter(ref => ref.type === git_1.RefType.Head)
                .map(ref => new CheckoutItem(ref));
            const tags = (includeTags ? repository.refs.filter(ref => ref.type === git_1.RefType.Tag) : [])
                .map(ref => new CheckoutTagItem(ref));
            const remoteHeads = (includeRemotes ? repository.refs.filter(ref => ref.type === git_1.RefType.RemoteHead) : [])
                .map(ref => new CheckoutRemoteHeadItem(ref));
            const picks = [createBranch, ...heads, ...tags, ...remoteHeads];
            const placeHolder = localize(51, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            yield choice.run(repository);
        });
    }
    branch(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield vscode_1.window.showInputBox({
                placeHolder: localize(52, null),
                prompt: localize(53, null),
                ignoreFocusOut: true
            });
            if (!result) {
                return;
            }
            const name = result.replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g, '-');
            yield repository.branch(name);
        });
    }
    deleteBranch(repository, name, force) {
        return __awaiter(this, void 0, void 0, function* () {
            let run;
            if (typeof name === 'string') {
                run = force => repository.deleteBranch(name, force);
            }
            else {
                const currentHead = repository.HEAD && repository.HEAD.name;
                const heads = repository.refs.filter(ref => ref.type === git_1.RefType.Head && ref.name !== currentHead)
                    .map(ref => new BranchDeleteItem(ref));
                const placeHolder = localize(54, null);
                const choice = yield vscode_1.window.showQuickPick(heads, { placeHolder });
                if (!choice || !choice.branchName) {
                    return;
                }
                name = choice.branchName;
                run = force => choice.run(repository, force);
            }
            try {
                yield run(force);
            }
            catch (err) {
                if (err.gitErrorCode !== git_1.GitErrorCodes.BranchNotFullyMerged) {
                    throw err;
                }
                const message = localize(55, null, name);
                const yes = localize(56, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick === yes) {
                    yield run(true);
                }
            }
        });
    }
    renameBranch(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const placeHolder = localize(57, null);
            const name = yield vscode_1.window.showInputBox({ placeHolder });
            if (!name || name.trim().length === 0) {
                return;
            }
            try {
                yield repository.renameBranch(name);
            }
            catch (err) {
                switch (err.gitErrorCode) {
                    case git_1.GitErrorCodes.InvalidBranchName:
                        vscode_1.window.showErrorMessage(localize(58, null));
                        return;
                    case git_1.GitErrorCodes.BranchAlreadyExists:
                        vscode_1.window.showErrorMessage(localize(59, null, name));
                        return;
                    default:
                        throw err;
                }
            }
        });
    }
    merge(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode_1.workspace.getConfiguration('git');
            const checkoutType = config.get('checkoutType') || 'all';
            const includeRemotes = checkoutType === 'all' || checkoutType === 'remote';
            const heads = repository.refs.filter(ref => ref.type === git_1.RefType.Head)
                .filter(ref => ref.name || ref.commit)
                .map(ref => new MergeItem(ref));
            const remoteHeads = (includeRemotes ? repository.refs.filter(ref => ref.type === git_1.RefType.RemoteHead) : [])
                .filter(ref => ref.name || ref.commit)
                .map(ref => new MergeItem(ref));
            const picks = [...heads, ...remoteHeads];
            const placeHolder = localize(60, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            try {
                yield choice.run(repository);
            }
            catch (err) {
                if (err.gitErrorCode !== git_1.GitErrorCodes.Conflict) {
                    throw err;
                }
                const message = localize(61, null);
                yield vscode_1.window.showWarningMessage(message);
            }
        });
    }
    createTag(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputTagName = yield vscode_1.window.showInputBox({
                placeHolder: localize(62, null),
                prompt: localize(63, null),
                ignoreFocusOut: true
            });
            if (!inputTagName) {
                return;
            }
            const inputMessage = yield vscode_1.window.showInputBox({
                placeHolder: localize(64, null),
                prompt: localize(65, null),
                ignoreFocusOut: true
            });
            const name = inputTagName.replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g, '-');
            const message = inputMessage || name;
            yield repository.tag(name, message);
        });
    }
    fetch(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            if (repository.remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(66, null));
                return;
            }
            yield repository.fetch();
        });
    }
    pullFrom(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(67, null));
                return;
            }
            const remotePicks = remotes.filter(r => r.fetchUrl !== undefined).map(r => ({ label: r.name, description: r.fetchUrl }));
            const placeHolder = localize(68, null);
            const remotePick = yield vscode_1.window.showQuickPick(remotePicks, { placeHolder });
            if (!remotePick) {
                return;
            }
            const remoteRefs = repository.refs;
            const remoteRefsFiltered = remoteRefs.filter(r => (r.remote === remotePick.label));
            const branchPicks = remoteRefsFiltered.map(r => ({ label: r.name }));
            const branchPick = yield vscode_1.window.showQuickPick(branchPicks, { placeHolder });
            if (!branchPick) {
                return;
            }
            const remoteCharCnt = remotePick.label.length;
            yield repository.pullFrom(false, remotePick.label, branchPick.label.slice(remoteCharCnt + 1));
        });
    }
    pull(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(69, null));
                return;
            }
            yield repository.pull(repository.HEAD);
        });
    }
    pullRebase(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(70, null));
                return;
            }
            yield repository.pullWithRebase(repository.HEAD);
        });
    }
    push(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(71, null));
                return;
            }
            if (!repository.HEAD || !repository.HEAD.name) {
                vscode_1.window.showWarningMessage(localize(72, null));
                return;
            }
            try {
                yield repository.push(repository.HEAD);
            }
            catch (err) {
                if (err.gitErrorCode !== git_1.GitErrorCodes.NoUpstreamBranch) {
                    throw err;
                }
                const branchName = repository.HEAD.name;
                const message = localize(73, null, branchName);
                const yes = localize(74, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick === yes) {
                    yield this.publish(repository);
                }
            }
        });
    }
    pushWithTags(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(75, null));
                return;
            }
            yield repository.pushTags();
            vscode_1.window.showInformationMessage(localize(76, null));
        });
    }
    pushTo(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(77, null));
                return;
            }
            if (!repository.HEAD || !repository.HEAD.name) {
                vscode_1.window.showWarningMessage(localize(78, null));
                return;
            }
            const branchName = repository.HEAD.name;
            const picks = remotes.filter(r => r.pushUrl !== undefined).map(r => ({ label: r.name, description: r.pushUrl }));
            const placeHolder = localize(79, null, branchName);
            const pick = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!pick) {
                return;
            }
            yield repository.pushTo(pick.label, branchName);
        });
    }
    _sync(repository, rebase) {
        return __awaiter(this, void 0, void 0, function* () {
            const HEAD = repository.HEAD;
            if (!HEAD || !HEAD.upstream) {
                return;
            }
            const remoteName = HEAD.remote || HEAD.upstream.remote;
            const remote = repository.remotes.find(r => r.name === remoteName);
            const isReadonly = remote && remote.isReadOnly;
            const config = vscode_1.workspace.getConfiguration('git');
            const shouldPrompt = !isReadonly && config.get('confirmSync') === true;
            if (shouldPrompt) {
                const message = localize(80, null, HEAD.upstream.remote, HEAD.upstream.name);
                const yes = localize(81, null);
                const neverAgain = localize(82, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes, neverAgain);
                if (pick === neverAgain) {
                    yield config.update('confirmSync', false, true);
                }
                else if (pick !== yes) {
                    return;
                }
            }
            if (rebase) {
                yield repository.syncRebase(HEAD);
            }
            else {
                yield repository.sync(HEAD);
            }
        });
    }
    sync(repository) {
        return this._sync(repository, false);
    }
    syncAll() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(this.model.repositories.map((repository) => __awaiter(this, void 0, void 0, function* () {
                const HEAD = repository.HEAD;
                if (!HEAD || !HEAD.upstream) {
                    return;
                }
                yield repository.sync(HEAD);
            })));
        });
    }
    syncRebase(repository) {
        return this._sync(repository, true);
    }
    publish(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(83, null));
                return;
            }
            const branchName = repository.HEAD && repository.HEAD.name || '';
            const selectRemote = () => __awaiter(this, void 0, void 0, function* () {
                const picks = repository.remotes.map(r => r.name);
                const placeHolder = localize(84, null, branchName);
                return yield vscode_1.window.showQuickPick(picks, { placeHolder });
            });
            const choice = remotes.length === 1 ? remotes[0].name : yield selectRemote();
            if (!choice) {
                return;
            }
            yield repository.pushTo(choice, branchName, true);
        });
    }
    ignore(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            resourceStates = resourceStates.filter(s => !!s);
            if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof vscode_1.Uri))) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const resources = resourceStates
                .filter(s => s instanceof repository_1.Resource)
                .map(r => r.resourceUri);
            if (!resources.length) {
                return;
            }
            yield this.runByRepository(resources, (repository, resources) => __awaiter(this, void 0, void 0, function* () { return repository.ignore(resources); }));
        });
    }
    _stash(repository, includeUntracked = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const noUnstagedChanges = repository.workingTreeGroup.resourceStates.length === 0;
            const noStagedChanges = repository.indexGroup.resourceStates.length === 0;
            if (noUnstagedChanges && noStagedChanges) {
                vscode_1.window.showInformationMessage(localize(85, null));
                return;
            }
            const message = yield this.getStashMessage();
            if (typeof message === 'undefined') {
                return;
            }
            yield repository.createStash(message, includeUntracked);
        });
    }
    getStashMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield vscode_1.window.showInputBox({
                prompt: localize(86, null),
                placeHolder: localize(87, null)
            });
        });
    }
    stash(repository) {
        return this._stash(repository);
    }
    stashIncludeUntracked(repository) {
        return this._stash(repository, true);
    }
    stashPop(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const stashes = yield repository.getStashes();
            if (stashes.length === 0) {
                vscode_1.window.showInformationMessage(localize(88, null));
                return;
            }
            const picks = stashes.map(r => ({ label: `#${r.index}:  ${r.description}`, description: '', details: '', id: r.index }));
            const placeHolder = localize(89, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            yield repository.popStash(choice.id);
        });
    }
    stashPopLatest(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const stashes = yield repository.getStashes();
            if (stashes.length === 0) {
                vscode_1.window.showInformationMessage(localize(90, null));
                return;
            }
            yield repository.popStash();
        });
    }
    createCommand(id, key, method, options) {
        const result = (...args) => {
            let result;
            if (!options.repository) {
                result = Promise.resolve(method.apply(this, args));
            }
            else {
                // try to guess the repository based on the first argument
                const repository = this.model.getRepository(args[0]);
                let repositoryPromise;
                if (repository) {
                    repositoryPromise = Promise.resolve(repository);
                }
                else if (this.model.repositories.length === 1) {
                    repositoryPromise = Promise.resolve(this.model.repositories[0]);
                }
                else {
                    repositoryPromise = this.model.pickRepository();
                }
                result = repositoryPromise.then(repository => {
                    if (!repository) {
                        return Promise.resolve();
                    }
                    return Promise.resolve(method.apply(this, [repository, ...args]));
                });
            }
            /* __GDPR__
                "git.command" : {
                    "command" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                }
            */
            this.telemetryReporter.sendTelemetryEvent('git.command', { command: id });
            return result.catch((err) => __awaiter(this, void 0, void 0, function* () {
                const options = {
                    modal: err.gitErrorCode === git_1.GitErrorCodes.DirtyWorkTree
                };
                let message;
                switch (err.gitErrorCode) {
                    case git_1.GitErrorCodes.DirtyWorkTree:
                        message = localize(91, null);
                        break;
                    case git_1.GitErrorCodes.PushRejected:
                        message = localize(92, null);
                        break;
                    default:
                        const hint = (err.stderr || err.message || String(err))
                            .replace(/^error: /mi, '')
                            .replace(/^> husky.*$/mi, '')
                            .split(/[\r\n]/)
                            .filter((line) => !!line)[0];
                        message = hint
                            ? localize(93, null, hint)
                            : localize(94, null);
                        break;
                }
                if (!message) {
                    console.error(err);
                    return;
                }
                options.modal = true;
                const outputChannel = this.outputChannel;
                const openOutputChannelChoice = localize(95, null);
                const choice = yield vscode_1.window.showErrorMessage(message, options, openOutputChannelChoice);
                if (choice === openOutputChannelChoice) {
                    outputChannel.show();
                }
            }));
        };
        // patch this object, so people can call methods directly
        this[key] = result;
        return result;
    }
    getSCMResource(uri) {
        uri = uri ? uri : (vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document.uri);
        this.outputChannel.appendLine(`git.getSCMResource.uri ${uri && uri.toString()}`);
        for (const r of this.model.repositories.map(r => r.root)) {
            this.outputChannel.appendLine(`repo root ${r}`);
        }
        if (!uri) {
            return undefined;
        }
        if (uri.scheme === 'git') {
            const { path } = uri_1.fromGitUri(uri);
            uri = vscode_1.Uri.file(path);
        }
        if (uri.scheme === 'file') {
            const uriString = uri.toString();
            const repository = this.model.getRepository(uri);
            if (!repository) {
                return undefined;
            }
            return repository.workingTreeGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0]
                || repository.indexGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0];
        }
    }
    runByRepository(arg, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const resources = arg instanceof vscode_1.Uri ? [arg] : arg;
            const isSingleResource = arg instanceof vscode_1.Uri;
            const groups = resources.reduce((result, resource) => {
                let repository = this.model.getRepository(resource);
                if (!repository) {
                    console.warn('Could not find git repository for ', resource);
                    return result;
                }
                // Could it be a submodule?
                if (util_1.pathEquals(resource.fsPath, repository.root)) {
                    repository = this.model.getRepositoryForSubmodule(resource) || repository;
                }
                const tuple = result.filter(p => p.repository === repository)[0];
                if (tuple) {
                    tuple.resources.push(resource);
                }
                else {
                    result.push({ repository, resources: [resource] });
                }
                return result;
            }, []);
            const promises = groups
                .map(({ repository, resources }) => fn(repository, isSingleResource ? resources[0] : resources));
            return Promise.all(promises);
        });
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
__decorate([
    command('git.refresh', { repository: true })
], CommandCenter.prototype, "refresh", null);
__decorate([
    command('git.openResource')
], CommandCenter.prototype, "openResource", null);
__decorate([
    command('git.clone')
], CommandCenter.prototype, "clone", null);
__decorate([
    command('git.init')
], CommandCenter.prototype, "init", null);
__decorate([
    command('git.close', { repository: true })
], CommandCenter.prototype, "close", null);
__decorate([
    command('git.openFile')
], CommandCenter.prototype, "openFile", null);
__decorate([
    command('git.openFile2')
], CommandCenter.prototype, "openFile2", null);
__decorate([
    command('git.openHEADFile')
], CommandCenter.prototype, "openHEADFile", null);
__decorate([
    command('git.openChange')
], CommandCenter.prototype, "openChange", null);
__decorate([
    command('git.stage')
], CommandCenter.prototype, "stage", null);
__decorate([
    command('git.stageAll', { repository: true })
], CommandCenter.prototype, "stageAll", null);
__decorate([
    command('git.stageChange')
], CommandCenter.prototype, "stageChange", null);
__decorate([
    command('git.stageSelectedRanges', { diff: true })
], CommandCenter.prototype, "stageSelectedChanges", null);
__decorate([
    command('git.revertChange')
], CommandCenter.prototype, "revertChange", null);
__decorate([
    command('git.revertSelectedRanges', { diff: true })
], CommandCenter.prototype, "revertSelectedRanges", null);
__decorate([
    command('git.unstage')
], CommandCenter.prototype, "unstage", null);
__decorate([
    command('git.unstageAll', { repository: true })
], CommandCenter.prototype, "unstageAll", null);
__decorate([
    command('git.unstageSelectedRanges', { diff: true })
], CommandCenter.prototype, "unstageSelectedRanges", null);
__decorate([
    command('git.clean')
], CommandCenter.prototype, "clean", null);
__decorate([
    command('git.cleanAll', { repository: true })
], CommandCenter.prototype, "cleanAll", null);
__decorate([
    command('git.commit', { repository: true })
], CommandCenter.prototype, "commit", null);
__decorate([
    command('git.commitWithInput', { repository: true })
], CommandCenter.prototype, "commitWithInput", null);
__decorate([
    command('git.commitStaged', { repository: true })
], CommandCenter.prototype, "commitStaged", null);
__decorate([
    command('git.commitStagedSigned', { repository: true })
], CommandCenter.prototype, "commitStagedSigned", null);
__decorate([
    command('git.commitStagedAmend', { repository: true })
], CommandCenter.prototype, "commitStagedAmend", null);
__decorate([
    command('git.commitAll', { repository: true })
], CommandCenter.prototype, "commitAll", null);
__decorate([
    command('git.commitAllSigned', { repository: true })
], CommandCenter.prototype, "commitAllSigned", null);
__decorate([
    command('git.commitAllAmend', { repository: true })
], CommandCenter.prototype, "commitAllAmend", null);
__decorate([
    command('git.undoCommit', { repository: true })
], CommandCenter.prototype, "undoCommit", null);
__decorate([
    command('git.checkout', { repository: true })
], CommandCenter.prototype, "checkout", null);
__decorate([
    command('git.branch', { repository: true })
], CommandCenter.prototype, "branch", null);
__decorate([
    command('git.deleteBranch', { repository: true })
], CommandCenter.prototype, "deleteBranch", null);
__decorate([
    command('git.renameBranch', { repository: true })
], CommandCenter.prototype, "renameBranch", null);
__decorate([
    command('git.merge', { repository: true })
], CommandCenter.prototype, "merge", null);
__decorate([
    command('git.createTag', { repository: true })
], CommandCenter.prototype, "createTag", null);
__decorate([
    command('git.fetch', { repository: true })
], CommandCenter.prototype, "fetch", null);
__decorate([
    command('git.pullFrom', { repository: true })
], CommandCenter.prototype, "pullFrom", null);
__decorate([
    command('git.pull', { repository: true })
], CommandCenter.prototype, "pull", null);
__decorate([
    command('git.pullRebase', { repository: true })
], CommandCenter.prototype, "pullRebase", null);
__decorate([
    command('git.push', { repository: true })
], CommandCenter.prototype, "push", null);
__decorate([
    command('git.pushWithTags', { repository: true })
], CommandCenter.prototype, "pushWithTags", null);
__decorate([
    command('git.pushTo', { repository: true })
], CommandCenter.prototype, "pushTo", null);
__decorate([
    command('git.sync', { repository: true })
], CommandCenter.prototype, "sync", null);
__decorate([
    command('git._syncAll')
], CommandCenter.prototype, "syncAll", null);
__decorate([
    command('git.syncRebase', { repository: true })
], CommandCenter.prototype, "syncRebase", null);
__decorate([
    command('git.publish', { repository: true })
], CommandCenter.prototype, "publish", null);
__decorate([
    command('git.ignore')
], CommandCenter.prototype, "ignore", null);
__decorate([
    command('git.stash', { repository: true })
], CommandCenter.prototype, "stash", null);
__decorate([
    command('git.stashIncludeUntracked', { repository: true })
], CommandCenter.prototype, "stashIncludeUntracked", null);
__decorate([
    command('git.stashPop', { repository: true })
], CommandCenter.prototype, "stashPop", null);
__decorate([
    command('git.stashPopLatest', { repository: true })
], CommandCenter.prototype, "stashPopLatest", null);
exports.CommandCenter = CommandCenter;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\git\out/commands.js.map
