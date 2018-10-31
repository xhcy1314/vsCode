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
const vscode = require("vscode");
const path_1 = require("path");
const diagnostics_1 = require("./features/diagnostics");
const fileSchemes = require("./utils/fileSchemes");
const baseCodeLensProvider_1 = require("./features/baseCodeLensProvider");
const memoize_1 = require("./utils/memoize");
const dispose_1 = require("./utils/dispose");
const validateSetting = 'validate.enable';
const suggestionSetting = 'suggestionActions.enabled';
class LanguageProvider {
    constructor(client, description, commandManager, telemetryReporter, typingsStatus, fileConfigurationManager) {
        this.client = client;
        this.description = description;
        this.commandManager = commandManager;
        this.telemetryReporter = telemetryReporter;
        this.typingsStatus = typingsStatus;
        this.fileConfigurationManager = fileConfigurationManager;
        this._validate = true;
        this._enableSuggestionDiagnostics = true;
        this.disposables = [];
        this.client.bufferSyncSupport.onDelete(resource => {
            this.diagnosticsManager.delete(resource);
        }, null, this.disposables);
        this.diagnosticsManager = new diagnostics_1.DiagnosticsManager(description.diagnosticOwner);
        vscode.workspace.onDidChangeConfiguration(this.configurationChanged, this, this.disposables);
        this.configurationChanged();
        client.onReady(async () => {
            await this.registerProviders();
        });
    }
    dispose() {
        dispose_1.disposeAll(this.disposables);
        this.diagnosticsManager.dispose();
    }
    get documentSelector() {
        const documentSelector = [];
        for (const language of this.description.modeIds) {
            for (const scheme of fileSchemes.supportedSchemes) {
                documentSelector.push({ language, scheme });
            }
        }
        return documentSelector;
    }
    async registerProviders() {
        const selector = this.documentSelector;
        const cachedResponse = new baseCodeLensProvider_1.CachedNavTreeResponse();
        this.disposables.push((await Promise.resolve().then(() => require('./features/completions'))).register(selector, this.client, this.typingsStatus, this.fileConfigurationManager, this.commandManager));
        this.disposables.push((await Promise.resolve().then(() => require('./features/definitions'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/directiveCommentCompletions'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/documentHighlight'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/documentSymbol'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/folding'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/formatting'))).register(selector, this.description.id, this.client, this.fileConfigurationManager));
        this.disposables.push((await Promise.resolve().then(() => require('./features/hover'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/implementations'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/implementationsCodeLens'))).register(selector, this.description.id, this.client, cachedResponse));
        this.disposables.push((await Promise.resolve().then(() => require('./features/jsDocCompletions'))).register(selector, this.client, this.commandManager));
        this.disposables.push((await Promise.resolve().then(() => require('./features/organizeImports'))).register(selector, this.client, this.commandManager, this.fileConfigurationManager));
        this.disposables.push((await Promise.resolve().then(() => require('./features/quickFix'))).register(selector, this.client, this.fileConfigurationManager, this.commandManager, this.diagnosticsManager, this.telemetryReporter));
        this.disposables.push((await Promise.resolve().then(() => require('./features/refactor'))).register(selector, this.client, this.fileConfigurationManager, this.commandManager, this.telemetryReporter));
        this.disposables.push((await Promise.resolve().then(() => require('./features/references'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/referencesCodeLens'))).register(selector, this.description.id, this.client, cachedResponse));
        this.disposables.push((await Promise.resolve().then(() => require('./features/rename'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/signatureHelp'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/tagCompletion'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/typeDefinitions'))).register(selector, this.client));
        this.disposables.push((await Promise.resolve().then(() => require('./features/workspaceSymbols'))).register(this.client, this.description.modeIds));
    }
    configurationChanged() {
        const config = vscode.workspace.getConfiguration(this.id, null);
        this.updateValidate(config.get(validateSetting, true));
        this.updateSuggestionDiagnostics(config.get(suggestionSetting, true));
    }
    handles(resource, doc) {
        if (doc && this.description.modeIds.indexOf(doc.languageId) >= 0) {
            return true;
        }
        const base = path_1.basename(resource.fsPath);
        return !!base && base === this.description.configFile;
    }
    get id() {
        return this.description.id;
    }
    get diagnosticSource() {
        return this.description.diagnosticSource;
    }
    updateValidate(value) {
        if (this._validate === value) {
            return;
        }
        this._validate = value;
        this.diagnosticsManager.validate = value;
        if (value) {
            this.triggerAllDiagnostics();
        }
    }
    updateSuggestionDiagnostics(value) {
        if (this._enableSuggestionDiagnostics === value) {
            return;
        }
        this._enableSuggestionDiagnostics = value;
        this.diagnosticsManager.enableSuggestions = value;
        if (value) {
            this.triggerAllDiagnostics();
        }
    }
    reInitialize() {
        this.diagnosticsManager.reInitialize();
    }
    triggerAllDiagnostics() {
        this.client.bufferSyncSupport.requestAllDiagnostics();
    }
    diagnosticsReceived(diagnosticsKind, file, diagnostics) {
        const config = vscode.workspace.getConfiguration(this.id, file);
        const reportUnnecessary = config.get('showUnused', true);
        this.diagnosticsManager.diagnosticsReceived(diagnosticsKind, file, diagnostics.filter(diag => {
            if (!reportUnnecessary) {
                diag.tags = undefined;
                if (diag.reportUnnecessary && diag.severity === vscode.DiagnosticSeverity.Hint) {
                    return false;
                }
            }
            return true;
        }));
    }
    configFileDiagnosticsReceived(file, diagnostics) {
        this.diagnosticsManager.configFileDiagnosticsReceived(file, diagnostics);
    }
}
__decorate([
    memoize_1.memoize
], LanguageProvider.prototype, "documentSelector", null);
exports.default = LanguageProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/languageProvider.js.map
