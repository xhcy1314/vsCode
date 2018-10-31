"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const dispose_1 = require("./dispose");
class ConditionalRegistration {
    constructor(_doRegister) {
        this._doRegister = _doRegister;
        this.registration = undefined;
    }
    dispose() {
        if (this.registration) {
            this.registration.dispose();
            this.registration = undefined;
        }
    }
    update(enabled) {
        if (enabled) {
            if (!this.registration) {
                this.registration = this._doRegister();
            }
        }
        else {
            if (this.registration) {
                this.registration.dispose();
                this.registration = undefined;
            }
        }
    }
}
class VersionDependentRegistration {
    constructor(client, minVersion, register) {
        this.client = client;
        this.minVersion = minVersion;
        this._disposables = [];
        this._registration = new ConditionalRegistration(register);
        this.update(client.apiVersion);
        this.client.onTsServerStarted(() => {
            this.update(this.client.apiVersion);
        }, null, this._disposables);
    }
    dispose() {
        dispose_1.disposeAll(this._disposables);
        this._registration.dispose();
    }
    update(api) {
        this._registration.update(api.gte(this.minVersion));
    }
}
exports.VersionDependentRegistration = VersionDependentRegistration;
class ConfigurationDependentRegistration {
    constructor(language, configValue, register) {
        this.language = language;
        this.configValue = configValue;
        this._disposables = [];
        this._registration = new ConditionalRegistration(register);
        this.update();
        vscode.workspace.onDidChangeConfiguration(() => {
            this.update();
        }, null, this._disposables);
    }
    dispose() {
        dispose_1.disposeAll(this._disposables);
        this._registration.dispose();
    }
    update() {
        const config = vscode.workspace.getConfiguration(this.language, null);
        this._registration.update(!!config.get(this.configValue));
    }
}
exports.ConfigurationDependentRegistration = ConfigurationDependentRegistration;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/utils\dependentRegistration.js.map
