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
const git_1 = require("./git");
const repository_1 = require("./repository");
const util_1 = require("./util");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
function isRemoteOperation(operation) {
    return operation === repository_1.Operation.Pull || operation === repository_1.Operation.Push || operation === repository_1.Operation.Sync || operation === repository_1.Operation.Fetch;
}
class AutoFetcher {
    constructor(repository, globalState) {
        this.repository = repository;
        this.globalState = globalState;
        this._onDidChange = new vscode_1.EventEmitter();
        this.onDidChange = this._onDidChange.event;
        this._enabled = false;
        this.disposables = [];
        vscode_1.workspace.onDidChangeConfiguration(this.onConfiguration, this, this.disposables);
        this.onConfiguration();
        const onGoodRemoteOperation = util_1.filterEvent(repository.onDidRunOperation, ({ operation, error }) => !error && isRemoteOperation(operation));
        const onFirstGoodRemoteOperation = util_1.onceEvent(onGoodRemoteOperation);
        onFirstGoodRemoteOperation(this.onFirstGoodRemoteOperation, this, this.disposables);
    }
    get enabled() { return this._enabled; }
    set enabled(enabled) { this._enabled = enabled; this._onDidChange.fire(enabled); }
    onFirstGoodRemoteOperation() {
        return __awaiter(this, void 0, void 0, function* () {
            const didInformUser = !this.globalState.get(AutoFetcher.DidInformUser);
            if (this.enabled && !didInformUser) {
                this.globalState.update(AutoFetcher.DidInformUser, true);
            }
            const shouldInformUser = !this.enabled && didInformUser;
            if (!shouldInformUser) {
                return;
            }
            const yes = { title: localize(0, null) };
            const no = { isCloseAffordance: true, title: localize(1, null) };
            const askLater = { title: localize(2, null) };
            const result = yield vscode_1.window.showInformationMessage(localize(3, null, 'https://go.microsoft.com/fwlink/?linkid=865294'), yes, no, askLater);
            if (result === askLater) {
                return;
            }
            if (result === yes) {
                const gitConfig = vscode_1.workspace.getConfiguration('git');
                gitConfig.update('autofetch', true, vscode_1.ConfigurationTarget.Global);
            }
            this.globalState.update(AutoFetcher.DidInformUser, true);
        });
    }
    onConfiguration() {
        const gitConfig = vscode_1.workspace.getConfiguration('git');
        if (gitConfig.get('autofetch') === false) {
            this.disable();
        }
        else {
            this.enable();
        }
    }
    enable() {
        if (this.enabled) {
            return;
        }
        this.enabled = true;
        this.run();
    }
    disable() {
        this.enabled = false;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.enabled) {
                yield this.repository.whenIdleAndFocused();
                if (!this.enabled) {
                    return;
                }
                try {
                    yield this.repository.fetch();
                }
                catch (err) {
                    if (err.gitErrorCode === git_1.GitErrorCodes.AuthenticationFailed) {
                        this.disable();
                    }
                }
                if (!this.enabled) {
                    return;
                }
                const timeout = new Promise(c => setTimeout(c, AutoFetcher.Period));
                const whenDisabled = util_1.eventToPromise(util_1.filterEvent(this.onDidChange, enabled => !enabled));
                yield Promise.race([timeout, whenDisabled]);
            }
        });
    }
    dispose() {
        this.disable();
        this.disposables.forEach(d => d.dispose());
    }
}
AutoFetcher.Period = 3 * 60 * 1000 /* three minutes */;
AutoFetcher.DidInformUser = 'autofetch.didInformUser';
exports.AutoFetcher = AutoFetcher;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\git\out/autofetch.js.map
