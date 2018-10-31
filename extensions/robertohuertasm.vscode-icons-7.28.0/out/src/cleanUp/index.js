"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const errorHandler_1 = require("../errorHandler");
function getAppUserPath(dirPath) {
    const vscodeAppName = /[\\|/]\.vscode-oss-dev/i.test(dirPath)
        ? 'code-oss-dev'
        : /[\\|/]\.vscode-oss/i.test(dirPath)
            ? 'Code - OSS'
            : /[\\|/]\.vscode-insiders/i.test(dirPath)
                ? 'Code - Insiders'
                : /[\\|/]\.vscode/i.test(dirPath)
                    ? 'Code'
                    : 'user-data';
    // workaround until `process.env.VSCODE_PORTABLE` gets available
    const vscodePortable = () => {
        if (vscodeAppName !== 'user-data') {
            return undefined;
        }
        let dataDir;
        switch (process.platform) {
            case 'darwin':
                const isInsiders = fs_1.existsSync(utils_1.pathUnixJoin(process.env.VSCODE_CWD, 'code-insiders-portable-data'));
                dataDir = `code-${isInsiders ? 'insiders-' : ''}portable-data`;
                break;
            default:
                dataDir = 'data';
                break;
        }
        return utils_1.pathUnixJoin(process.env.VSCODE_CWD, dataDir);
    };
    const appPath = process.env.VSCODE_PORTABLE || vscodePortable() || utils_1.vscodePath();
    return utils_1.pathUnixJoin(appPath, vscodeAppName, 'User');
}
exports.getAppUserPath = getAppUserPath;
function removeVSIconsSettings(settings) {
    Reflect.ownKeys(settings)
        .map(key => key.toString())
        .filter(key => /^vsicons\..+/.test(key))
        .forEach(key => delete settings[key]);
}
exports.removeVSIconsSettings = removeVSIconsSettings;
function resetThemeSetting(settings) {
    if (settings[constants_1.constants.vscode.iconThemeSetting] === constants_1.constants.extensionName) {
        delete settings[constants_1.constants.vscode.iconThemeSetting];
    }
}
exports.resetThemeSetting = resetThemeSetting;
function cleanUpVSCodeSettings() {
    const saveSettings = content => {
        const settings = JSON.stringify(content, null, 4);
        fs_1.writeFile(settingsFilePath, settings, error => errorHandler_1.ErrorHandler.logError(error));
    };
    const cleanUpSettings = (error, content) => {
        if (error) {
            errorHandler_1.ErrorHandler.logError(error, true);
            return;
        }
        const settings = utils_1.parseJSON(content);
        if (!settings) {
            return;
        }
        removeVSIconsSettings(settings);
        resetThemeSetting(settings);
        saveSettings(settings);
    };
    const settingsFilePath = utils_1.pathUnixJoin(getAppUserPath(__dirname), 'settings.json');
    fs_1.readFile(settingsFilePath, 'utf8', cleanUpSettings);
}
exports.cleanUpVSCodeSettings = cleanUpVSCodeSettings;
function cleanUpVSIconsSettings() {
    const extensionSettingsFilePath = utils_1.pathUnixJoin(getAppUserPath(__dirname), constants_1.constants.extensionSettingsFilename);
    fs_1.unlink(extensionSettingsFilePath, error => errorHandler_1.ErrorHandler.logError(error));
}
exports.cleanUpVSIconsSettings = cleanUpVSIconsSettings;
//# sourceMappingURL=index.js.map