"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
const path = require("path");
const fs = require("fs");
const vscode_1 = require("vscode");
const relativePathResolver_1 = require("./relativePathResolver");
const api_1 = require("./api");
class TypeScriptVersion {
    constructor(path, _pathLabel) {
        this.path = path;
        this._pathLabel = _pathLabel;
    }
    get tsServerPath() {
        return path.join(this.path, 'tsserver.js');
    }
    get pathLabel() {
        return typeof this._pathLabel === 'undefined' ? this.path : this._pathLabel;
    }
    get isValid() {
        return this.version !== undefined;
    }
    get version() {
        const version = this.getTypeScriptVersion(this.tsServerPath);
        if (version) {
            return version;
        }
        // Allow TS developers to provide custom version
        const tsdkVersion = vscode_1.workspace.getConfiguration().get('typescript.tsdk_version', undefined);
        if (tsdkVersion) {
            return api_1.default.fromVersionString(tsdkVersion);
        }
        return undefined;
    }
    get versionString() {
        const version = this.version;
        return version ? version.versionString : localize(0, null);
    }
    getTypeScriptVersion(serverPath) {
        if (!fs.existsSync(serverPath)) {
            return undefined;
        }
        const p = serverPath.split(path.sep);
        if (p.length <= 2) {
            return undefined;
        }
        const p2 = p.slice(0, -2);
        const modulePath = p2.join(path.sep);
        let fileName = path.join(modulePath, 'package.json');
        if (!fs.existsSync(fileName)) {
            // Special case for ts dev versions
            if (path.basename(modulePath) === 'built') {
                fileName = path.join(modulePath, '..', 'package.json');
            }
        }
        if (!fs.existsSync(fileName)) {
            return undefined;
        }
        const contents = fs.readFileSync(fileName).toString();
        let desc = null;
        try {
            desc = JSON.parse(contents);
        }
        catch (err) {
            return undefined;
        }
        if (!desc || !desc.version) {
            return undefined;
        }
        return desc.version ? api_1.default.fromVersionString(desc.version) : undefined;
    }
}
exports.TypeScriptVersion = TypeScriptVersion;
class TypeScriptVersionProvider {
    constructor(configuration) {
        this.configuration = configuration;
        this.relativePathResolver = new relativePathResolver_1.RelativeWorkspacePathResolver();
    }
    updateConfiguration(configuration) {
        this.configuration = configuration;
    }
    get defaultVersion() {
        return this.globalVersion || this.bundledVersion;
    }
    get globalVersion() {
        if (this.configuration.globalTsdk) {
            const globals = this.loadVersionsFromSetting(this.configuration.globalTsdk);
            if (globals && globals.length) {
                return globals[0];
            }
        }
        return undefined;
    }
    get localVersion() {
        const tsdkVersions = this.localTsdkVersions;
        if (tsdkVersions && tsdkVersions.length) {
            return tsdkVersions[0];
        }
        const nodeVersions = this.localNodeModulesVersions;
        if (nodeVersions && nodeVersions.length === 1) {
            return nodeVersions[0];
        }
        return undefined;
    }
    get localVersions() {
        const allVersions = this.localTsdkVersions.concat(this.localNodeModulesVersions);
        const paths = new Set();
        return allVersions.filter(x => {
            if (paths.has(x.path)) {
                return false;
            }
            paths.add(x.path);
            return true;
        });
    }
    get bundledVersion() {
        try {
            const bundledVersion = new TypeScriptVersion(path.dirname(require.resolve('typescript/lib/tsserver.js')), '');
            if (bundledVersion.isValid) {
                return bundledVersion;
            }
        }
        catch (e) {
            // noop
        }
        vscode_1.window.showErrorMessage(localize(1, null));
        throw new Error('Could not find bundled tsserver.js');
    }
    get localTsdkVersions() {
        const localTsdk = this.configuration.localTsdk;
        return localTsdk ? this.loadVersionsFromSetting(localTsdk) : [];
    }
    loadVersionsFromSetting(tsdkPathSetting) {
        if (path.isAbsolute(tsdkPathSetting)) {
            return [new TypeScriptVersion(tsdkPathSetting)];
        }
        const workspacePath = this.relativePathResolver.asAbsoluteWorkspacePath(tsdkPathSetting);
        if (workspacePath !== undefined) {
            return [new TypeScriptVersion(workspacePath, tsdkPathSetting)];
        }
        return this.loadTypeScriptVersionsFromPath(tsdkPathSetting);
    }
    get localNodeModulesVersions() {
        return this.loadTypeScriptVersionsFromPath(path.join('node_modules', 'typescript', 'lib'))
            .filter(x => x.isValid);
    }
    loadTypeScriptVersionsFromPath(relativePath) {
        if (!vscode_1.workspace.workspaceFolders) {
            return [];
        }
        const versions = [];
        for (const root of vscode_1.workspace.workspaceFolders) {
            let label = relativePath;
            if (vscode_1.workspace.workspaceFolders && vscode_1.workspace.workspaceFolders.length > 1) {
                label = path.join(root.name, relativePath);
            }
            versions.push(new TypeScriptVersion(path.join(root.uri.fsPath, relativePath), label));
        }
        return versions;
    }
}
exports.TypeScriptVersionProvider = TypeScriptVersionProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/utils\versionProvider.js.map
