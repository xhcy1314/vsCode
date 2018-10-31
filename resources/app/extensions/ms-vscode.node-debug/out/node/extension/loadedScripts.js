/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
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
const nls = require("vscode-nls");
const vscode = require("vscode");
const vscode_1 = require("vscode");
const path_1 = require("path");
const localize = nls.loadMessageBundle(__filename);
//---- loaded script explorer
const URL_REGEXP = /^(https?:\/\/[^/]+)(\/.*)$/;
class Source {
    constructor(path) {
        this.name = path_1.basename(path);
        this.path = path;
    }
}
class LoadedScriptItem {
    constructor(source) {
        this.label = path_1.basename(source.path);
        this.description = source.path;
        this.source = source;
    }
}
class LoadedScriptsProvider {
    constructor(context) {
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._root = new RootTreeItem();
        context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => __awaiter(this, void 0, void 0, function* () {
            const t = session ? session.type : undefined;
            if (yield this.isSupportedDebugType(t, session)) {
                vscode.commands.executeCommand('setContext', 'showLoadedScriptsExplorer', true);
                this._root.add(session);
                this._onDidChangeTreeData.fire(undefined);
            }
        })));
        let timeout;
        context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => __awaiter(this, void 0, void 0, function* () {
            const t = (event.event === 'loadedSource' && event.session) ? event.session.type : undefined;
            if (yield this.isSupportedDebugType(t, event.session)) {
                const sessionRoot = this._root.add(event.session);
                sessionRoot.addPath(event.body.source);
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this._onDidChangeTreeData.fire(undefined);
                }, 300);
            }
        })));
        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
            this._root.remove(session.id);
            this._onDidChangeTreeData.fire(undefined);
        }));
    }
    getChildren(node) {
        return (node || this._root).getChildren();
    }
    getTreeItem(node) {
        return node;
    }
    isSupportedDebugType(debugType, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (debugType === 'vslsShare') {
                try {
                    debugType = session ? yield session.customRequest('debugType', {}) : undefined;
                }
                catch (e) {
                }
            }
            return debugType === 'node' || debugType === 'node2' || debugType === 'extensionHost' || debugType === 'chrome';
        });
    }
}
exports.LoadedScriptsProvider = LoadedScriptsProvider;
class BaseTreeItem extends vscode_1.TreeItem {
    constructor(label, state = vscode.TreeItemCollapsibleState.Collapsed) {
        super(label, state);
        this._children = {};
    }
    setSource(session, source) {
        this.command = {
            command: 'extension.node-debug.openScript',
            arguments: [session, source],
            title: ''
        };
    }
    getChildren() {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const array = Object.keys(this._children).map(key => this._children[key]);
        return array.sort((a, b) => this.compare(a, b));
    }
    createIfNeeded(key, factory) {
        let child = this._children[key];
        if (!child) {
            child = factory(key);
            this._children[key] = child;
        }
        return child;
    }
    remove(key) {
        delete this._children[key];
    }
    compare(a, b) {
        if (a.label && b.label) {
            return a.label.localeCompare(b.label);
        }
        return 0;
    }
}
class RootTreeItem extends BaseTreeItem {
    constructor() {
        super('Root', vscode.TreeItemCollapsibleState.Expanded);
        this._showedMoreThanOne = false;
    }
    getChildren() {
        // skip sessions if there is only one
        const children = super.getChildren();
        if (Array.isArray(children)) {
            const size = children.length;
            if (!this._showedMoreThanOne && size === 1) {
                return children[0].getChildren();
            }
            this._showedMoreThanOne = size > 1;
        }
        return children;
    }
    add(session) {
        return this.createIfNeeded(session.id, () => new SessionTreeItem(session));
    }
}
class SessionTreeItem extends BaseTreeItem {
    constructor(session) {
        super(session.name, vscode.TreeItemCollapsibleState.Expanded);
        this._initialized = false;
        this._session = session;
        /*
        const dir = dirname(__filename);
        this.iconPath = {
            light: join(dir, '..', '..', '..', 'images', 'debug-light.svg'),
            dark: join(dir, '..', '..', '..', 'images', 'debug-dark.svg')
        };
        */
    }
    getChildren() {
        if (!this._initialized) {
            this._initialized = true;
            return listLoadedScripts(this._session).then(paths => {
                if (paths) {
                    paths.forEach(path => this.addPath(path));
                }
                return super.getChildren();
            });
        }
        return super.getChildren();
    }
    compare(a, b) {
        const acat = this.category(a);
        const bcat = this.category(b);
        if (acat !== bcat) {
            return acat - bcat;
        }
        return super.compare(a, b);
    }
    /**
     * Return an ordinal number for folders
     */
    category(item) {
        // workspace scripts come at the beginning in "folder" order
        if (item instanceof FolderTreeItem) {
            return item.folder.index;
        }
        // <...> come at the very end
        if (item.label && /^<.+>$/.test(item.label)) {
            return 1000;
        }
        // everything else in between
        return 999;
    }
    addPath(source) {
        let folder;
        let url;
        let p;
        let path = source.path;
        const match = URL_REGEXP.exec(path);
        if (match && match.length === 3) {
            url = match[1];
            p = decodeURI(match[2]);
        }
        else {
            folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path));
            p = trim(path);
        }
        let x = this;
        p.split(/[\/\\]/).forEach((segment, i) => {
            if (segment.length === 0) {
                segment = '/';
            }
            if (i === 0 && folder) {
                x = x.createIfNeeded(folder.name, () => new FolderTreeItem(folder));
            }
            else if (i === 0 && url) {
                x = x.createIfNeeded(url, () => new BaseTreeItem(url));
            }
            else {
                x = x.createIfNeeded(segment, () => new BaseTreeItem(segment));
            }
        });
        x.collapsibleState = vscode.TreeItemCollapsibleState.None;
        x.setSource(this._session, source);
    }
}
class FolderTreeItem extends BaseTreeItem {
    constructor(folder) {
        super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.folder = folder;
    }
}
//---- loaded script picker
function pickLoadedScript() {
    const session = vscode.debug.activeDebugSession;
    return listLoadedScripts(session).then(sources => {
        let options = {
            placeHolder: localize(0, null),
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true
        };
        let items;
        if (sources === undefined) {
            items = [{ label: localize(1, null), description: '' }];
        }
        else {
            items = sources.map(source => new LoadedScriptItem(source)).sort((a, b) => a.label.localeCompare(b.label));
        }
        vscode.window.showQuickPick(items, options).then(item => {
            if (item && item.source) {
                openScript(session, item.source);
            }
        });
    });
}
exports.pickLoadedScript = pickLoadedScript;
let USERHOME;
function getUserHome() {
    if (!USERHOME) {
        USERHOME = require('os').homedir();
        if (USERHOME && USERHOME[USERHOME.length - 1] !== '/') {
            USERHOME += '/';
        }
    }
    return USERHOME;
}
function trim(path) {
    path = vscode.workspace.asRelativePath(path, true);
    if (path.indexOf('/') === 0) {
        path = path.replace(getUserHome(), '~/');
    }
    return path;
}
function listLoadedScripts(session) {
    if (session) {
        return session.customRequest('loadedSources').then(reply => {
            return reply.sources;
        }, err => {
            return undefined;
        });
    }
    else {
        return Promise.resolve(undefined);
    }
}
function openScript(session, source) {
    let debug = `debug:${encodeURIComponent(source.path)}`;
    let sep = '?';
    if (session) {
        debug += `${sep}session=${encodeURIComponent(session.id)}`;
        sep = '&';
    }
    if (source.sourceReference) {
        debug += `${sep}ref=${source.sourceReference}`;
    }
    let uri = vscode.Uri.parse(debug);
    vscode.workspace.openTextDocument(uri).then(doc => vscode.window.showTextDocument(doc));
}
exports.openScript = openScript;

//# sourceMappingURL=../../../out/node/extension/loadedScripts.js.map
