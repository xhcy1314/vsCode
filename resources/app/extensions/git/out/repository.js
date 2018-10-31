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
const util_1 = require("./util");
const decorators_1 = require("./decorators");
const uri_1 = require("./uri");
const autofetch_1 = require("./autofetch");
const path = require("path");
const nls = require("vscode-nls");
const fs = require("fs");
const statusbar_1 = require("./statusbar");
const timeout = (millis) => new Promise(c => setTimeout(c, millis));
const localize = nls.loadMessageBundle(__filename);
const iconsRootPath = path.join(path.dirname(__dirname), 'resources', 'icons');
function getIconUri(iconName, theme) {
    return vscode_1.Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}
var RepositoryState;
(function (RepositoryState) {
    RepositoryState[RepositoryState["Idle"] = 0] = "Idle";
    RepositoryState[RepositoryState["Disposed"] = 1] = "Disposed";
})(RepositoryState = exports.RepositoryState || (exports.RepositoryState = {}));
var Status;
(function (Status) {
    Status[Status["INDEX_MODIFIED"] = 0] = "INDEX_MODIFIED";
    Status[Status["INDEX_ADDED"] = 1] = "INDEX_ADDED";
    Status[Status["INDEX_DELETED"] = 2] = "INDEX_DELETED";
    Status[Status["INDEX_RENAMED"] = 3] = "INDEX_RENAMED";
    Status[Status["INDEX_COPIED"] = 4] = "INDEX_COPIED";
    Status[Status["MODIFIED"] = 5] = "MODIFIED";
    Status[Status["DELETED"] = 6] = "DELETED";
    Status[Status["UNTRACKED"] = 7] = "UNTRACKED";
    Status[Status["IGNORED"] = 8] = "IGNORED";
    Status[Status["ADDED_BY_US"] = 9] = "ADDED_BY_US";
    Status[Status["ADDED_BY_THEM"] = 10] = "ADDED_BY_THEM";
    Status[Status["DELETED_BY_US"] = 11] = "DELETED_BY_US";
    Status[Status["DELETED_BY_THEM"] = 12] = "DELETED_BY_THEM";
    Status[Status["BOTH_ADDED"] = 13] = "BOTH_ADDED";
    Status[Status["BOTH_DELETED"] = 14] = "BOTH_DELETED";
    Status[Status["BOTH_MODIFIED"] = 15] = "BOTH_MODIFIED";
})(Status = exports.Status || (exports.Status = {}));
var ResourceGroupType;
(function (ResourceGroupType) {
    ResourceGroupType[ResourceGroupType["Merge"] = 0] = "Merge";
    ResourceGroupType[ResourceGroupType["Index"] = 1] = "Index";
    ResourceGroupType[ResourceGroupType["WorkingTree"] = 2] = "WorkingTree";
})(ResourceGroupType = exports.ResourceGroupType || (exports.ResourceGroupType = {}));
class Resource {
    constructor(_resourceGroupType, _resourceUri, _type, _useIcons, _renameResourceUri) {
        this._resourceGroupType = _resourceGroupType;
        this._resourceUri = _resourceUri;
        this._type = _type;
        this._useIcons = _useIcons;
        this._renameResourceUri = _renameResourceUri;
    }
    get resourceUri() {
        if (this.renameResourceUri && (this._type === Status.MODIFIED || this._type === Status.DELETED || this._type === Status.INDEX_RENAMED || this._type === Status.INDEX_COPIED)) {
            return this.renameResourceUri;
        }
        return this._resourceUri;
    }
    get command() {
        return {
            command: 'git.openResource',
            title: localize(0, null),
            arguments: [this]
        };
    }
    get resourceGroupType() { return this._resourceGroupType; }
    get type() { return this._type; }
    get original() { return this._resourceUri; }
    get renameResourceUri() { return this._renameResourceUri; }
    getIconPath(theme) {
        switch (this.type) {
            case Status.INDEX_MODIFIED: return Resource.Icons[theme].Modified;
            case Status.MODIFIED: return Resource.Icons[theme].Modified;
            case Status.INDEX_ADDED: return Resource.Icons[theme].Added;
            case Status.INDEX_DELETED: return Resource.Icons[theme].Deleted;
            case Status.DELETED: return Resource.Icons[theme].Deleted;
            case Status.INDEX_RENAMED: return Resource.Icons[theme].Renamed;
            case Status.INDEX_COPIED: return Resource.Icons[theme].Copied;
            case Status.UNTRACKED: return Resource.Icons[theme].Untracked;
            case Status.IGNORED: return Resource.Icons[theme].Ignored;
            case Status.BOTH_DELETED: return Resource.Icons[theme].Conflict;
            case Status.ADDED_BY_US: return Resource.Icons[theme].Conflict;
            case Status.DELETED_BY_THEM: return Resource.Icons[theme].Conflict;
            case Status.ADDED_BY_THEM: return Resource.Icons[theme].Conflict;
            case Status.DELETED_BY_US: return Resource.Icons[theme].Conflict;
            case Status.BOTH_ADDED: return Resource.Icons[theme].Conflict;
            case Status.BOTH_MODIFIED: return Resource.Icons[theme].Conflict;
        }
    }
    get tooltip() {
        switch (this.type) {
            case Status.INDEX_MODIFIED: return localize(1, null);
            case Status.MODIFIED: return localize(2, null);
            case Status.INDEX_ADDED: return localize(3, null);
            case Status.INDEX_DELETED: return localize(4, null);
            case Status.DELETED: return localize(5, null);
            case Status.INDEX_RENAMED: return localize(6, null);
            case Status.INDEX_COPIED: return localize(7, null);
            case Status.UNTRACKED: return localize(8, null);
            case Status.IGNORED: return localize(9, null);
            case Status.BOTH_DELETED: return localize(10, null);
            case Status.ADDED_BY_US: return localize(11, null);
            case Status.DELETED_BY_THEM: return localize(12, null);
            case Status.ADDED_BY_THEM: return localize(13, null);
            case Status.DELETED_BY_US: return localize(14, null);
            case Status.BOTH_ADDED: return localize(15, null);
            case Status.BOTH_MODIFIED: return localize(16, null);
            default: return '';
        }
    }
    get strikeThrough() {
        switch (this.type) {
            case Status.DELETED:
            case Status.BOTH_DELETED:
            case Status.DELETED_BY_THEM:
            case Status.DELETED_BY_US:
            case Status.INDEX_DELETED:
                return true;
            default:
                return false;
        }
    }
    get faded() {
        // TODO@joao
        return false;
        // const workspaceRootPath = this.workspaceRoot.fsPath;
        // return this.resourceUri.fsPath.substr(0, workspaceRootPath.length) !== workspaceRootPath;
    }
    get decorations() {
        const light = this._useIcons ? { iconPath: this.getIconPath('light') } : undefined;
        const dark = this._useIcons ? { iconPath: this.getIconPath('dark') } : undefined;
        const tooltip = this.tooltip;
        const strikeThrough = this.strikeThrough;
        const faded = this.faded;
        const letter = this.letter;
        const color = this.color;
        return { strikeThrough, faded, tooltip, light, dark, letter, color, source: 'git.resource' /*todo@joh*/ };
    }
    get letter() {
        switch (this.type) {
            case Status.INDEX_MODIFIED:
            case Status.MODIFIED:
                return 'M';
            case Status.INDEX_ADDED:
                return 'A';
            case Status.INDEX_DELETED:
            case Status.DELETED:
                return 'D';
            case Status.INDEX_RENAMED:
                return 'R';
            case Status.UNTRACKED:
                return 'U';
            case Status.IGNORED:
                return 'I';
            case Status.INDEX_COPIED:
            case Status.BOTH_DELETED:
            case Status.ADDED_BY_US:
            case Status.DELETED_BY_THEM:
            case Status.ADDED_BY_THEM:
            case Status.DELETED_BY_US:
            case Status.BOTH_ADDED:
            case Status.BOTH_MODIFIED:
                return 'C';
        }
    }
    get color() {
        switch (this.type) {
            case Status.INDEX_MODIFIED:
            case Status.MODIFIED:
                return new vscode_1.ThemeColor('gitDecoration.modifiedResourceForeground');
            case Status.INDEX_DELETED:
            case Status.DELETED:
                return new vscode_1.ThemeColor('gitDecoration.deletedResourceForeground');
            case Status.INDEX_ADDED:
                return new vscode_1.ThemeColor('gitDecoration.addedResourceForeground');
            case Status.INDEX_RENAMED: // todo@joh - special color?
            case Status.UNTRACKED:
                return new vscode_1.ThemeColor('gitDecoration.untrackedResourceForeground');
            case Status.IGNORED:
                return new vscode_1.ThemeColor('gitDecoration.ignoredResourceForeground');
            case Status.INDEX_COPIED:
            case Status.BOTH_DELETED:
            case Status.ADDED_BY_US:
            case Status.DELETED_BY_THEM:
            case Status.ADDED_BY_THEM:
            case Status.DELETED_BY_US:
            case Status.BOTH_ADDED:
            case Status.BOTH_MODIFIED:
                return new vscode_1.ThemeColor('gitDecoration.conflictingResourceForeground');
        }
    }
    get priority() {
        switch (this.type) {
            case Status.INDEX_MODIFIED:
            case Status.MODIFIED:
                return 2;
            case Status.IGNORED:
                return 3;
            case Status.INDEX_COPIED:
            case Status.BOTH_DELETED:
            case Status.ADDED_BY_US:
            case Status.DELETED_BY_THEM:
            case Status.ADDED_BY_THEM:
            case Status.DELETED_BY_US:
            case Status.BOTH_ADDED:
            case Status.BOTH_MODIFIED:
                return 4;
            default:
                return 1;
        }
    }
    get resourceDecoration() {
        const title = this.tooltip;
        const abbreviation = this.letter;
        const color = this.color;
        const priority = this.priority;
        return { bubble: true, source: 'git.resource', title, abbreviation, color, priority };
    }
}
Resource.Icons = {
    light: {
        Modified: getIconUri('status-modified', 'light'),
        Added: getIconUri('status-added', 'light'),
        Deleted: getIconUri('status-deleted', 'light'),
        Renamed: getIconUri('status-renamed', 'light'),
        Copied: getIconUri('status-copied', 'light'),
        Untracked: getIconUri('status-untracked', 'light'),
        Ignored: getIconUri('status-ignored', 'light'),
        Conflict: getIconUri('status-conflict', 'light'),
    },
    dark: {
        Modified: getIconUri('status-modified', 'dark'),
        Added: getIconUri('status-added', 'dark'),
        Deleted: getIconUri('status-deleted', 'dark'),
        Renamed: getIconUri('status-renamed', 'dark'),
        Copied: getIconUri('status-copied', 'dark'),
        Untracked: getIconUri('status-untracked', 'dark'),
        Ignored: getIconUri('status-ignored', 'dark'),
        Conflict: getIconUri('status-conflict', 'dark')
    }
};
__decorate([
    decorators_1.memoize
], Resource.prototype, "resourceUri", null);
__decorate([
    decorators_1.memoize
], Resource.prototype, "command", null);
__decorate([
    decorators_1.memoize
], Resource.prototype, "faded", null);
exports.Resource = Resource;
var Operation;
(function (Operation) {
    Operation["Status"] = "Status";
    Operation["Diff"] = "Diff";
    Operation["Add"] = "Add";
    Operation["RevertFiles"] = "RevertFiles";
    Operation["Commit"] = "Commit";
    Operation["Clean"] = "Clean";
    Operation["Branch"] = "Branch";
    Operation["Checkout"] = "Checkout";
    Operation["Reset"] = "Reset";
    Operation["Fetch"] = "Fetch";
    Operation["Pull"] = "Pull";
    Operation["Push"] = "Push";
    Operation["Sync"] = "Sync";
    Operation["Show"] = "Show";
    Operation["Stage"] = "Stage";
    Operation["GetCommitTemplate"] = "GetCommitTemplate";
    Operation["DeleteBranch"] = "DeleteBranch";
    Operation["RenameBranch"] = "RenameBranch";
    Operation["Merge"] = "Merge";
    Operation["Ignore"] = "Ignore";
    Operation["Tag"] = "Tag";
    Operation["Stash"] = "Stash";
    Operation["CheckIgnore"] = "CheckIgnore";
    Operation["LSTree"] = "LSTree";
    Operation["SubmoduleUpdate"] = "SubmoduleUpdate";
})(Operation = exports.Operation || (exports.Operation = {}));
function isReadOnly(operation) {
    switch (operation) {
        case Operation.Show:
        case Operation.GetCommitTemplate:
        case Operation.CheckIgnore:
        case Operation.LSTree:
            return true;
        default:
            return false;
    }
}
function shouldShowProgress(operation) {
    switch (operation) {
        case Operation.Fetch:
        case Operation.CheckIgnore:
        case Operation.LSTree:
        case Operation.Show:
            return false;
        default:
            return true;
    }
}
class OperationsImpl {
    constructor() {
        this.operations = new Map();
    }
    start(operation) {
        this.operations.set(operation, (this.operations.get(operation) || 0) + 1);
    }
    end(operation) {
        const count = (this.operations.get(operation) || 0) - 1;
        if (count <= 0) {
            this.operations.delete(operation);
        }
        else {
            this.operations.set(operation, count);
        }
    }
    isRunning(operation) {
        return this.operations.has(operation);
    }
    isIdle() {
        const operations = this.operations.keys();
        for (const operation of operations) {
            if (!isReadOnly(operation)) {
                return false;
            }
        }
        return true;
    }
    shouldShowProgress() {
        const operations = this.operations.keys();
        for (const operation of operations) {
            if (shouldShowProgress(operation)) {
                return true;
            }
        }
        return false;
    }
}
class ProgressManager {
    constructor(repository) {
        this.disposable = util_1.EmptyDisposable;
        const start = util_1.onceEvent(util_1.filterEvent(repository.onDidChangeOperations, () => repository.operations.shouldShowProgress()));
        const end = util_1.onceEvent(util_1.filterEvent(util_1.debounceEvent(repository.onDidChangeOperations, 300), () => !repository.operations.shouldShowProgress()));
        const setup = () => {
            this.disposable = start(() => {
                const promise = util_1.eventToPromise(end).then(() => setup());
                vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.SourceControl }, () => promise);
            });
        };
        setup();
    }
    dispose() {
        this.disposable.dispose();
    }
}
class Repository {
    constructor(repository, globalState) {
        this.repository = repository;
        this._onDidChangeRepository = new vscode_1.EventEmitter();
        this.onDidChangeRepository = this._onDidChangeRepository.event;
        this._onDidChangeState = new vscode_1.EventEmitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._onDidChangeStatus = new vscode_1.EventEmitter();
        this.onDidRunGitStatus = this._onDidChangeStatus.event;
        this._onDidChangeOriginalResource = new vscode_1.EventEmitter();
        this.onDidChangeOriginalResource = this._onDidChangeOriginalResource.event;
        this._onRunOperation = new vscode_1.EventEmitter();
        this.onRunOperation = this._onRunOperation.event;
        this._onDidRunOperation = new vscode_1.EventEmitter();
        this.onDidRunOperation = this._onDidRunOperation.event;
        this._refs = [];
        this._remotes = [];
        this._submodules = [];
        this._operations = new OperationsImpl();
        this._state = RepositoryState.Idle;
        this.isRepositoryHuge = false;
        this.didWarnAboutLimit = false;
        this.disposables = [];
        const fsWatcher = vscode_1.workspace.createFileSystemWatcher('**');
        this.disposables.push(fsWatcher);
        const onWorkspaceChange = util_1.anyEvent(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
        const onRepositoryChange = util_1.filterEvent(onWorkspaceChange, uri => util_1.isDescendant(repository.root, uri.fsPath));
        const onRelevantRepositoryChange = util_1.filterEvent(onRepositoryChange, uri => !/\/\.git(\/index\.lock)?$/.test(uri.path));
        onRelevantRepositoryChange(this.onFSChange, this, this.disposables);
        const onRelevantGitChange = util_1.filterEvent(onRelevantRepositoryChange, uri => /\/\.git\//.test(uri.path));
        onRelevantGitChange(this._onDidChangeRepository.fire, this._onDidChangeRepository, this.disposables);
        this._sourceControl = vscode_1.scm.createSourceControl('git', 'Git', vscode_1.Uri.file(repository.root));
        this._sourceControl.inputBox.placeholder = localize(17, null);
        this._sourceControl.acceptInputCommand = { command: 'git.commitWithInput', title: localize(18, null), arguments: [this._sourceControl] };
        this._sourceControl.quickDiffProvider = this;
        this._sourceControl.inputBox.validateInput = this.validateInput.bind(this);
        this.disposables.push(this._sourceControl);
        this._mergeGroup = this._sourceControl.createResourceGroup('merge', localize(19, null));
        this._indexGroup = this._sourceControl.createResourceGroup('index', localize(20, null));
        this._workingTreeGroup = this._sourceControl.createResourceGroup('workingTree', localize(21, null));
        this.mergeGroup.hideWhenEmpty = true;
        this.indexGroup.hideWhenEmpty = true;
        this.disposables.push(this.mergeGroup);
        this.disposables.push(this.indexGroup);
        this.disposables.push(this.workingTreeGroup);
        this.disposables.push(new autofetch_1.AutoFetcher(this, globalState));
        const statusBar = new statusbar_1.StatusBarCommands(this);
        this.disposables.push(statusBar);
        statusBar.onDidChange(() => this._sourceControl.statusBarCommands = statusBar.commands, null, this.disposables);
        this._sourceControl.statusBarCommands = statusBar.commands;
        const progressManager = new ProgressManager(this);
        this.disposables.push(progressManager);
        this.updateCommitTemplate();
        this.status();
    }
    get onDidChangeOperations() {
        return util_1.anyEvent(this.onRunOperation, this.onDidRunOperation);
    }
    get sourceControl() { return this._sourceControl; }
    get inputBox() { return this._sourceControl.inputBox; }
    get mergeGroup() { return this._mergeGroup; }
    get indexGroup() { return this._indexGroup; }
    get workingTreeGroup() { return this._workingTreeGroup; }
    get HEAD() {
        return this._HEAD;
    }
    get refs() {
        return this._refs;
    }
    get remotes() {
        return this._remotes;
    }
    get submodules() {
        return this._submodules;
    }
    get operations() { return this._operations; }
    get state() { return this._state; }
    set state(state) {
        this._state = state;
        this._onDidChangeState.fire(state);
        this._HEAD = undefined;
        this._refs = [];
        this._remotes = [];
        this.mergeGroup.resourceStates = [];
        this.indexGroup.resourceStates = [];
        this.workingTreeGroup.resourceStates = [];
        this._sourceControl.count = 0;
    }
    get root() {
        return this.repository.root;
    }
    validateInput(text, position) {
        const config = vscode_1.workspace.getConfiguration('git');
        const setting = config.get('inputValidation');
        if (setting === 'off') {
            return;
        }
        if (/^\s+$/.test(text)) {
            return {
                message: localize(22, null),
                type: vscode_1.SourceControlInputBoxValidationType.Warning
            };
        }
        let start = 0, end;
        let match;
        const regex = /\r?\n/g;
        while ((match = regex.exec(text)) && position > match.index) {
            start = match.index + match[0].length;
        }
        end = match ? match.index : text.length;
        const line = text.substring(start, end);
        if (line.length <= Repository.InputValidationLength) {
            if (setting !== 'always') {
                return;
            }
            return {
                message: localize(23, null, Repository.InputValidationLength - line.length),
                type: vscode_1.SourceControlInputBoxValidationType.Information
            };
        }
        else {
            return {
                message: localize(24, null, line.length - Repository.InputValidationLength, Repository.InputValidationLength),
                type: vscode_1.SourceControlInputBoxValidationType.Warning
            };
        }
    }
    provideOriginalResource(uri) {
        if (uri.scheme !== 'file') {
            return;
        }
        return uri_1.toGitUri(uri, '', { replaceFileExtension: true });
    }
    updateCommitTemplate() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._sourceControl.commitTemplate = yield this.repository.getCommitTemplate();
            }
            catch (e) {
                // noop
            }
        });
    }
    status() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Status);
        });
    }
    diff(path, options = {}) {
        return this.run(Operation.Diff, () => this.repository.diff(path, options));
    }
    add(resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Add, () => this.repository.add(resources.map(r => r.fsPath)));
        });
    }
    stage(resource, contents) {
        return __awaiter(this, void 0, void 0, function* () {
            const relativePath = path.relative(this.repository.root, resource.fsPath).replace(/\\/g, '/');
            yield this.run(Operation.Stage, () => this.repository.stage(relativePath, contents));
            this._onDidChangeOriginalResource.fire(resource);
        });
    }
    revert(resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.RevertFiles, () => this.repository.revert('HEAD', resources.map(r => r.fsPath)));
        });
    }
    commit(message, opts = Object.create(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Commit, () => __awaiter(this, void 0, void 0, function* () {
                if (opts.all) {
                    yield this.repository.add([]);
                }
                yield this.repository.commit(message, opts);
            }));
        });
    }
    clean(resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Clean, () => __awaiter(this, void 0, void 0, function* () {
                const toClean = [];
                const toCheckout = [];
                const submodulesToUpdate = [];
                resources.forEach(r => {
                    const fsPath = r.fsPath;
                    for (const submodule of this.submodules) {
                        if (path.join(this.root, submodule.path) === fsPath) {
                            submodulesToUpdate.push(fsPath);
                            return;
                        }
                    }
                    const raw = r.toString();
                    const scmResource = util_1.find(this.workingTreeGroup.resourceStates, sr => sr.resourceUri.toString() === raw);
                    if (!scmResource) {
                        return;
                    }
                    switch (scmResource.type) {
                        case Status.UNTRACKED:
                        case Status.IGNORED:
                            toClean.push(fsPath);
                            break;
                        default:
                            toCheckout.push(fsPath);
                            break;
                    }
                });
                const promises = [];
                if (toClean.length > 0) {
                    promises.push(this.repository.clean(toClean));
                }
                if (toCheckout.length > 0) {
                    promises.push(this.repository.checkout('', toCheckout));
                }
                if (submodulesToUpdate.length > 0) {
                    promises.push(this.repository.updateSubmodules(submodulesToUpdate));
                }
                yield Promise.all(promises);
            }));
        });
    }
    branch(name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Branch, () => this.repository.branch(name, true));
        });
    }
    deleteBranch(name, force) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.DeleteBranch, () => this.repository.deleteBranch(name, force));
        });
    }
    renameBranch(name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.RenameBranch, () => this.repository.renameBranch(name));
        });
    }
    merge(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Merge, () => this.repository.merge(ref));
        });
    }
    tag(name, message) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Tag, () => this.repository.tag(name, message));
        });
    }
    checkout(treeish) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Checkout, () => this.repository.checkout(treeish, []));
        });
    }
    getCommit(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getCommit(ref);
        });
    }
    reset(treeish, hard) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Reset, () => this.repository.reset(treeish, hard));
        });
    }
    fetch() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Fetch, () => this.repository.fetch());
        });
    }
    pullWithRebase(head) {
        return __awaiter(this, void 0, void 0, function* () {
            let remote;
            let branch;
            if (head && head.name && head.upstream) {
                remote = head.upstream.remote;
                branch = `${head.upstream.name}`;
            }
            yield this.run(Operation.Pull, () => this.repository.pull(true, remote, branch));
        });
    }
    pull(head) {
        return __awaiter(this, void 0, void 0, function* () {
            let remote;
            let branch;
            if (head && head.name && head.upstream) {
                remote = head.upstream.remote;
                branch = `${head.upstream.name}`;
            }
            yield this.run(Operation.Pull, () => this.repository.pull(false, remote, branch));
        });
    }
    pullFrom(rebase, remote, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Pull, () => this.repository.pull(rebase, remote, branch));
        });
    }
    push(head) {
        return __awaiter(this, void 0, void 0, function* () {
            let remote;
            let branch;
            if (head && head.name && head.upstream) {
                remote = head.upstream.remote;
                branch = `${head.name}:${head.upstream.name}`;
            }
            yield this.run(Operation.Push, () => this.repository.push(remote, branch));
        });
    }
    pushTo(remote, name, setUpstream = false) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Push, () => this.repository.push(remote, name, setUpstream));
        });
    }
    pushTags(remote) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Push, () => this.repository.push(remote, undefined, false, true));
        });
    }
    sync(head) {
        return this._sync(head, false);
    }
    syncRebase(head) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sync(head, true);
        });
    }
    _sync(head, rebase) {
        return __awaiter(this, void 0, void 0, function* () {
            let remoteName;
            let pullBranch;
            let pushBranch;
            if (head.name && head.upstream) {
                remoteName = head.upstream.remote;
                pullBranch = `${head.upstream.name}`;
                pushBranch = `${head.name}:${head.upstream.name}`;
            }
            yield this.run(Operation.Sync, () => __awaiter(this, void 0, void 0, function* () {
                yield this.repository.pull(rebase, remoteName, pullBranch);
                const remote = this.remotes.find(r => r.name === remoteName);
                if (remote && remote.isReadOnly) {
                    return;
                }
                const shouldPush = this.HEAD && (typeof this.HEAD.ahead === 'number' ? this.HEAD.ahead > 0 : true);
                if (shouldPush) {
                    yield this.repository.push(remoteName, pushBranch);
                }
            }));
        });
    }
    show(ref, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.run(Operation.Show, () => {
                const relativePath = path.relative(this.repository.root, filePath).replace(/\\/g, '/');
                const configFiles = vscode_1.workspace.getConfiguration('files', vscode_1.Uri.file(filePath));
                const defaultEncoding = configFiles.get('encoding');
                const autoGuessEncoding = configFiles.get('autoGuessEncoding');
                return this.repository.bufferString(`${ref}:${relativePath}`, defaultEncoding, autoGuessEncoding);
            });
        });
    }
    buffer(ref, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.run(Operation.Show, () => {
                const relativePath = path.relative(this.repository.root, filePath).replace(/\\/g, '/');
                return this.repository.buffer(`${ref}:${relativePath}`);
            });
        });
    }
    lstree(ref, filePath) {
        return this.run(Operation.LSTree, () => this.repository.lstree(ref, filePath));
    }
    detectObjectType(object) {
        return this.run(Operation.Show, () => this.repository.detectObjectType(object));
    }
    getStashes() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getStashes();
        });
    }
    createStash(message, includeUntracked) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Stash, () => this.repository.createStash(message, includeUntracked));
        });
    }
    popStash(index) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Stash, () => this.repository.popStash(index));
        });
    }
    getCommitTemplate() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.GetCommitTemplate, () => __awaiter(this, void 0, void 0, function* () { return this.repository.getCommitTemplate(); }));
        });
    }
    ignore(files) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Ignore, () => __awaiter(this, void 0, void 0, function* () {
                const ignoreFile = `${this.repository.root}${path.sep}.gitignore`;
                const textToAppend = files
                    .map(uri => path.relative(this.repository.root, uri.fsPath).replace(/\\/g, '/'))
                    .join('\n');
                const document = (yield new Promise(c => fs.exists(ignoreFile, c)))
                    ? yield vscode_1.workspace.openTextDocument(ignoreFile)
                    : yield vscode_1.workspace.openTextDocument(vscode_1.Uri.file(ignoreFile).with({ scheme: 'untitled' }));
                yield vscode_1.window.showTextDocument(document);
                const edit = new vscode_1.WorkspaceEdit();
                const lastLine = document.lineAt(document.lineCount - 1);
                const text = lastLine.isEmptyOrWhitespace ? `${textToAppend}\n` : `\n${textToAppend}\n`;
                edit.insert(document.uri, lastLine.range.end, text);
                vscode_1.workspace.applyEdit(edit);
            }));
        });
    }
    checkIgnore(filePaths) {
        return this.run(Operation.CheckIgnore, () => {
            return new Promise((resolve, reject) => {
                filePaths = filePaths
                    .filter(filePath => util_1.isDescendant(this.root, filePath));
                if (filePaths.length === 0) {
                    // nothing left
                    return resolve(new Set());
                }
                // https://git-scm.com/docs/git-check-ignore#git-check-ignore--z
                const child = this.repository.stream(['check-ignore', '-z', '--stdin'], { stdio: [null, null, null] });
                child.stdin.end(filePaths.join('\0'), 'utf8');
                const onExit = (exitCode) => {
                    if (exitCode === 1) {
                        // nothing ignored
                        resolve(new Set());
                    }
                    else if (exitCode === 0) {
                        // paths are separated by the null-character
                        resolve(new Set(data.split('\0')));
                    }
                    else {
                        if (/ is in submodule /.test(stderr)) {
                            reject(new git_1.GitError({ stdout: data, stderr, exitCode, gitErrorCode: git_1.GitErrorCodes.IsInSubmodule }));
                        }
                        else {
                            reject(new git_1.GitError({ stdout: data, stderr, exitCode }));
                        }
                    }
                };
                let data = '';
                const onStdoutData = (raw) => {
                    data += raw;
                };
                child.stdout.setEncoding('utf8');
                child.stdout.on('data', onStdoutData);
                let stderr = '';
                child.stderr.setEncoding('utf8');
                child.stderr.on('data', raw => stderr += raw);
                child.on('error', reject);
                child.on('exit', onExit);
            });
        });
    }
    run(operation, runOperation = () => Promise.resolve(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state !== RepositoryState.Idle) {
                throw new Error('Repository not initialized');
            }
            let error = null;
            this._operations.start(operation);
            this._onRunOperation.fire(operation);
            try {
                const result = yield this.retryRun(runOperation);
                if (!isReadOnly(operation)) {
                    yield this.updateModelState();
                }
                return result;
            }
            catch (err) {
                error = err;
                if (err.gitErrorCode === git_1.GitErrorCodes.NotAGitRepository) {
                    this.state = RepositoryState.Disposed;
                }
                throw err;
            }
            finally {
                this._operations.end(operation);
                this._onDidRunOperation.fire({ operation, error });
            }
        });
    }
    retryRun(runOperation = () => Promise.resolve(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempt = 0;
            while (true) {
                try {
                    attempt++;
                    return yield runOperation();
                }
                catch (err) {
                    if (err.gitErrorCode === git_1.GitErrorCodes.RepositoryIsLocked && attempt <= 10) {
                        // quatratic backoff
                        yield timeout(Math.pow(attempt, 2) * 50);
                    }
                    else {
                        throw err;
                    }
                }
            }
        });
    }
    updateModelState() {
        return __awaiter(this, void 0, void 0, function* () {
            const { status, didHitLimit } = yield this.repository.getStatus();
            const config = vscode_1.workspace.getConfiguration('git');
            const shouldIgnore = config.get('ignoreLimitWarning') === true;
            const useIcons = !config.get('decorations.enabled', true);
            this.isRepositoryHuge = didHitLimit;
            if (didHitLimit && !shouldIgnore && !this.didWarnAboutLimit) {
                const neverAgain = { title: localize(25, null) };
                vscode_1.window.showWarningMessage(localize(26, null, this.repository.root), neverAgain).then(result => {
                    if (result === neverAgain) {
                        config.update('ignoreLimitWarning', true, false);
                    }
                });
                this.didWarnAboutLimit = true;
            }
            let HEAD;
            try {
                HEAD = yield this.repository.getHEAD();
                if (HEAD.name) {
                    try {
                        HEAD = yield this.repository.getBranch(HEAD.name);
                    }
                    catch (err) {
                        // noop
                    }
                }
            }
            catch (err) {
                // noop
            }
            const [refs, remotes, submodules] = yield Promise.all([this.repository.getRefs(), this.repository.getRemotes(), this.repository.getSubmodules()]);
            this._HEAD = HEAD;
            this._refs = refs;
            this._remotes = remotes;
            this._submodules = submodules;
            const index = [];
            const workingTree = [];
            const merge = [];
            status.forEach(raw => {
                const uri = vscode_1.Uri.file(path.join(this.repository.root, raw.path));
                const renameUri = raw.rename ? vscode_1.Uri.file(path.join(this.repository.root, raw.rename)) : undefined;
                switch (raw.x + raw.y) {
                    case '??': return workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.UNTRACKED, useIcons));
                    case '!!': return workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.IGNORED, useIcons));
                    case 'DD': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.BOTH_DELETED, useIcons));
                    case 'AU': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.ADDED_BY_US, useIcons));
                    case 'UD': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.DELETED_BY_THEM, useIcons));
                    case 'UA': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.ADDED_BY_THEM, useIcons));
                    case 'DU': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.DELETED_BY_US, useIcons));
                    case 'AA': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.BOTH_ADDED, useIcons));
                    case 'UU': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.BOTH_MODIFIED, useIcons));
                }
                switch (raw.x) {
                    case 'M':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_MODIFIED, useIcons));
                        break;
                    case 'A':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_ADDED, useIcons));
                        break;
                    case 'D':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_DELETED, useIcons));
                        break;
                    case 'R':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_RENAMED, useIcons, renameUri));
                        break;
                    case 'C':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_COPIED, useIcons, renameUri));
                        break;
                }
                switch (raw.y) {
                    case 'M':
                        workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.MODIFIED, useIcons, renameUri));
                        break;
                    case 'D':
                        workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.DELETED, useIcons, renameUri));
                        break;
                }
            });
            // set resource groups
            this.mergeGroup.resourceStates = merge;
            this.indexGroup.resourceStates = index;
            this.workingTreeGroup.resourceStates = workingTree;
            // set count badge
            const countBadge = vscode_1.workspace.getConfiguration('git').get('countBadge');
            let count = merge.length + index.length + workingTree.length;
            switch (countBadge) {
                case 'off':
                    count = 0;
                    break;
                case 'tracked':
                    count = count - workingTree.filter(r => r.type === Status.UNTRACKED || r.type === Status.IGNORED).length;
                    break;
            }
            this._sourceControl.count = count;
            // Disable `Discard All Changes` for "fresh" repositories
            // https://github.com/Microsoft/vscode/issues/43066
            vscode_1.commands.executeCommand('setContext', 'gitFreshRepository', !this._HEAD || !this._HEAD.commit);
            this._onDidChangeStatus.fire();
        });
    }
    onFSChange(uri) {
        const config = vscode_1.workspace.getConfiguration('git');
        const autorefresh = config.get('autorefresh');
        if (!autorefresh) {
            return;
        }
        if (this.isRepositoryHuge) {
            return;
        }
        if (!this.operations.isIdle()) {
            return;
        }
        this.eventuallyUpdateWhenIdleAndWait();
    }
    eventuallyUpdateWhenIdleAndWait() {
        this.updateWhenIdleAndWait();
    }
    updateWhenIdleAndWait() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.whenIdleAndFocused();
            yield this.status();
            yield timeout(5000);
        });
    }
    whenIdleAndFocused() {
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                if (!this.operations.isIdle()) {
                    yield util_1.eventToPromise(this.onDidRunOperation);
                    continue;
                }
                if (!vscode_1.window.state.focused) {
                    const onDidFocusWindow = util_1.filterEvent(vscode_1.window.onDidChangeWindowState, e => e.focused);
                    yield util_1.eventToPromise(onDidFocusWindow);
                    continue;
                }
                return;
            }
        });
    }
    get headLabel() {
        const HEAD = this.HEAD;
        if (!HEAD) {
            return '';
        }
        const tag = this.refs.filter(iref => iref.type === git_1.RefType.Tag && iref.commit === HEAD.commit)[0];
        const tagName = tag && tag.name;
        const head = HEAD.name || tagName || (HEAD.commit || '').substr(0, 8);
        return head
            + (this.workingTreeGroup.resourceStates.length > 0 ? '*' : '')
            + (this.indexGroup.resourceStates.length > 0 ? '+' : '')
            + (this.mergeGroup.resourceStates.length > 0 ? '!' : '');
    }
    get syncLabel() {
        if (!this.HEAD
            || !this.HEAD.name
            || !this.HEAD.commit
            || !this.HEAD.upstream
            || !(this.HEAD.ahead || this.HEAD.behind)) {
            return '';
        }
        const remoteName = this.HEAD && this.HEAD.remote || this.HEAD.upstream.remote;
        const remote = this.remotes.find(r => r.name === remoteName);
        if (remote && remote.isReadOnly) {
            return `${this.HEAD.behind}↓`;
        }
        return `${this.HEAD.behind}↓ ${this.HEAD.ahead}↑`;
    }
    dispose() {
        this.disposables = util_1.dispose(this.disposables);
    }
}
Repository.InputValidationLength = 72;
__decorate([
    decorators_1.memoize
], Repository.prototype, "onDidChangeOperations", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "status", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "fetch", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "pullWithRebase", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "pull", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "push", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "sync", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "syncRebase", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "updateModelState", null);
__decorate([
    decorators_1.debounce(1000)
], Repository.prototype, "eventuallyUpdateWhenIdleAndWait", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "updateWhenIdleAndWait", null);
exports.Repository = Repository;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\git\out/repository.js.map
