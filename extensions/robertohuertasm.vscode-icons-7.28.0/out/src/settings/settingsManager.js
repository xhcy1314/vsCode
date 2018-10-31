"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const semver = require("semver");
const utils_1 = require("../utils");
const models_1 = require("../models");
const extensionSettings_1 = require("./extensionSettings");
const constants_1 = require("../constants");
const errorHandler_1 = require("../errorHandler");
class SettingsManager {
    constructor(vscode) {
        this.vscode = vscode;
        this.getSettings();
    }
    getSettings() {
        if (this.settings) {
            return this.settings;
        }
        const isDev = /dev/i.test(this.vscode.env.appName);
        const isOSS = !isDev && /oss/i.test(this.vscode.env.appName);
        const isInsiders = /insiders/i.test(this.vscode.env.appName);
        const vscodeVersion = new semver.SemVer(this.vscode.version).version;
        const isWin = /^win/.test(process.platform);
        const vscodeAppName = process.env.VSCODE_PORTABLE
            ? 'user-data'
            : isInsiders
                ? 'Code - Insiders'
                : isOSS
                    ? 'Code - OSS'
                    : isDev
                        ? 'code-oss-dev'
                        : 'Code';
        const appPath = process.env.VSCODE_PORTABLE || utils_1.vscodePath();
        const vscodeAppUserPath = utils_1.pathUnixJoin(appPath, vscodeAppName, 'User');
        const workspacePath = this.getWorkspacePath();
        this.settings = {
            vscodeAppUserPath,
            workspacePath,
            isWin,
            isInsiders,
            isOSS,
            isDev,
            settingsFilePath: utils_1.pathUnixJoin(vscodeAppUserPath, constants_1.constants.extensionSettingsFilename),
            vscodeVersion,
            extensionSettings: extensionSettings_1.extensionSettings,
        };
        return this.settings;
    }
    getWorkspacePath() {
        if (this.vscode.workspace.workspaceFolders) {
            return this.vscode.workspace.workspaceFolders.reduce((a, b) => {
                a.push(b.uri.fsPath);
                return a;
            }, []);
        }
        if (this.vscode.workspace.rootPath) {
            return [this.vscode.workspace.rootPath];
        }
    }
    getState() {
        const defaultState = {
            version: '0.0.0',
            status: models_1.ExtensionStatus.notActivated,
            welcomeShown: false,
        };
        if (!fs.existsSync(this.settings.settingsFilePath)) {
            return defaultState;
        }
        try {
            const state = fs.readFileSync(this.settings.settingsFilePath, 'utf8');
            return utils_1.parseJSON(state) || defaultState;
        }
        catch (error) {
            errorHandler_1.ErrorHandler.logError(error, true);
            return defaultState;
        }
    }
    setState(state) {
        try {
            fs.writeFileSync(this.settings.settingsFilePath, JSON.stringify(state));
        }
        catch (error) {
            errorHandler_1.ErrorHandler.logError(error);
        }
    }
    updateStatus(sts) {
        const state = this.getState();
        state.version = extensionSettings_1.extensionSettings.version;
        state.status = sts == null ? state.status : sts;
        state.welcomeShown = true;
        this.setState(state);
        return state;
    }
    deleteState() {
        fs.unlinkSync(this.settings.settingsFilePath);
    }
    isNewVersion() {
        return semver.lt(this.getState().version, this.settings.extensionSettings.version);
    }
}
exports.SettingsManager = SettingsManager;
//# sourceMappingURL=settingsManager.js.map