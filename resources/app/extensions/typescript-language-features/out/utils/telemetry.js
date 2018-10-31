"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
const memoize_1 = require("./memoize");
class TelemetryReporter {
    constructor(clientVersionDelegate) {
        this.clientVersionDelegate = clientVersionDelegate;
        this._reporter = null;
    }
    dispose() {
        if (this._reporter) {
            this._reporter.dispose();
            this._reporter = null;
        }
    }
    logTelemetry(eventName, properties) {
        const reporter = this.reporter;
        if (reporter) {
            if (!properties) {
                properties = {};
            }
            /* __GDPR__FRAGMENT__
                "TypeScriptCommonProperties" : {
                    "version" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                }
            */
            properties['version'] = this.clientVersionDelegate();
            reporter.sendTelemetryEvent(eventName, properties);
        }
    }
    get reporter() {
        if (this.packageInfo && this.packageInfo.aiKey) {
            this._reporter = new vscode_extension_telemetry_1.default(this.packageInfo.name, this.packageInfo.version, this.packageInfo.aiKey);
            return this._reporter;
        }
        return null;
    }
    get packageInfo() {
        const packagePath = path.join(__dirname, '..', '..', 'package.json');
        const extensionPackage = require(packagePath);
        if (extensionPackage) {
            return {
                name: extensionPackage.name,
                version: extensionPackage.version,
                aiKey: extensionPackage.aiKey
            };
        }
        return null;
    }
}
__decorate([
    memoize_1.memoize
], TelemetryReporter.prototype, "reporter", null);
__decorate([
    memoize_1.memoize
], TelemetryReporter.prototype, "packageInfo", null);
exports.default = TelemetryReporter;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/utils\telemetry.js.map
