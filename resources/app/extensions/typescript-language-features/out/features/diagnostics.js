"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const resourceMap_1 = require("./resourceMap");
class DiagnosticSet {
    constructor() {
        this._map = new resourceMap_1.ResourceMap();
    }
    set(file, diagnostics) {
        this._map.set(file, diagnostics);
    }
    get(file) {
        return this._map.get(file) || [];
    }
    clear() {
        this._map = new resourceMap_1.ResourceMap();
    }
}
exports.DiagnosticSet = DiagnosticSet;
var DiagnosticKind;
(function (DiagnosticKind) {
    DiagnosticKind[DiagnosticKind["Syntax"] = 0] = "Syntax";
    DiagnosticKind[DiagnosticKind["Semantic"] = 1] = "Semantic";
    DiagnosticKind[DiagnosticKind["Suggestion"] = 2] = "Suggestion";
})(DiagnosticKind = exports.DiagnosticKind || (exports.DiagnosticKind = {}));
const allDiagnosticKinds = [DiagnosticKind.Syntax, DiagnosticKind.Semantic, DiagnosticKind.Suggestion];
class DiagnosticsManager {
    constructor(owner) {
        this._diagnostics = new Map();
        this._pendingUpdates = new resourceMap_1.ResourceMap();
        this._validate = true;
        this._enableSuggestions = true;
        this.updateDelay = 50;
        for (const kind of allDiagnosticKinds) {
            this._diagnostics.set(kind, new DiagnosticSet());
        }
        this._currentDiagnostics = vscode.languages.createDiagnosticCollection(owner);
    }
    dispose() {
        this._currentDiagnostics.dispose();
        for (const value of this._pendingUpdates.values) {
            clearTimeout(value);
        }
        this._pendingUpdates = new resourceMap_1.ResourceMap();
    }
    reInitialize() {
        this._currentDiagnostics.clear();
        for (const diagnosticSet of this._diagnostics.values()) {
            diagnosticSet.clear();
        }
    }
    set validate(value) {
        if (this._validate === value) {
            return;
        }
        this._validate = value;
        if (!value) {
            this._currentDiagnostics.clear();
        }
    }
    set enableSuggestions(value) {
        if (this._enableSuggestions === value) {
            return;
        }
        this._enableSuggestions = value;
        if (!value) {
            this._currentDiagnostics.clear();
        }
    }
    diagnosticsReceived(kind, file, diagnostics) {
        const collection = this._diagnostics.get(kind);
        if (!collection) {
            return;
        }
        if (diagnostics.length === 0) {
            const existing = collection.get(file);
            if (existing.length === 0) {
                // No need to update
                return;
            }
        }
        collection.set(file, diagnostics);
        this.scheduleDiagnosticsUpdate(file);
    }
    configFileDiagnosticsReceived(file, diagnostics) {
        this._currentDiagnostics.set(file, diagnostics);
    }
    delete(resource) {
        this._currentDiagnostics.delete(resource);
    }
    getDiagnostics(file) {
        return this._currentDiagnostics.get(file) || [];
    }
    scheduleDiagnosticsUpdate(file) {
        if (!this._pendingUpdates.has(file)) {
            this._pendingUpdates.set(file, setTimeout(() => this.updateCurrentDiagnostics(file), this.updateDelay));
        }
    }
    updateCurrentDiagnostics(file) {
        if (this._pendingUpdates.has(file)) {
            clearTimeout(this._pendingUpdates.get(file));
            this._pendingUpdates.delete(file);
        }
        if (!this._validate) {
            return;
        }
        const allDiagnostics = [
            ...this._diagnostics.get(DiagnosticKind.Syntax).get(file),
            ...this._diagnostics.get(DiagnosticKind.Semantic).get(file),
            ...this.getSuggestionDiagnostics(file),
        ];
        this._currentDiagnostics.set(file, allDiagnostics);
    }
    getSuggestionDiagnostics(file) {
        return this._diagnostics.get(DiagnosticKind.Suggestion).get(file).filter(x => {
            if (!this._enableSuggestions) {
                // Still show unused
                return x.tags && x.tags.indexOf(vscode.DiagnosticTag.Unnecessary) !== -1;
            }
            return true;
        });
    }
}
exports.DiagnosticsManager = DiagnosticsManager;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/features\diagnostics.js.map
