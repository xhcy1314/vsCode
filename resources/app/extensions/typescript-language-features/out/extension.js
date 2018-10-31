"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const commands = require("./commands");
const languageConfiguration_1 = require("./features/languageConfiguration");
const task_1 = require("./features/task");
const typeScriptServiceClientHost_1 = require("./typeScriptServiceClientHost");
const commandManager_1 = require("./utils/commandManager");
const fileSchemes = require("./utils/fileSchemes");
const languageDescription_1 = require("./utils/languageDescription");
const lazy_1 = require("./utils/lazy");
const logDirectoryProvider_1 = require("./utils/logDirectoryProvider");
const managedFileContext_1 = require("./utils/managedFileContext");
const plugins_1 = require("./utils/plugins");
const ProjectStatus = require("./utils/projectStatus");
function activate(context) {
    const plugins = plugins_1.getContributedTypeScriptServerPlugins();
    const commandManager = new commandManager_1.CommandManager();
    context.subscriptions.push(commandManager);
    const lazyClientHost = createLazyClientHost(context, plugins, commandManager);
    registerCommands(commandManager, lazyClientHost);
    context.subscriptions.push(new task_1.default(lazyClientHost.map(x => x.serviceClient)));
    context.subscriptions.push(new languageConfiguration_1.LanguageConfigurationManager());
    const supportedLanguage = [].concat.apply([], languageDescription_1.standardLanguageDescriptions.map(x => x.modeIds).concat(plugins.map(x => x.languages)));
    function didOpenTextDocument(textDocument) {
        if (isSupportedDocument(supportedLanguage, textDocument)) {
            openListener.dispose();
            // Force activation
            // tslint:disable-next-line:no-unused-expression
            void lazyClientHost.value;
            context.subscriptions.push(new managedFileContext_1.default(resource => {
                return lazyClientHost.value.serviceClient.toPath(resource);
            }));
            return true;
        }
        return false;
    }
    const openListener = vscode.workspace.onDidOpenTextDocument(didOpenTextDocument, undefined, context.subscriptions);
    for (const textDocument of vscode.workspace.textDocuments) {
        if (didOpenTextDocument(textDocument)) {
            break;
        }
    }
}
exports.activate = activate;
function createLazyClientHost(context, plugins, commandManager) {
    return lazy_1.lazy(() => {
        const logDirectoryProvider = new logDirectoryProvider_1.default(context);
        const clientHost = new typeScriptServiceClientHost_1.default(languageDescription_1.standardLanguageDescriptions, context.workspaceState, plugins, commandManager, logDirectoryProvider);
        context.subscriptions.push(clientHost);
        clientHost.serviceClient.onReady(() => {
            context.subscriptions.push(ProjectStatus.create(clientHost.serviceClient, clientHost.serviceClient.telemetryReporter));
        });
        return clientHost;
    });
}
function registerCommands(commandManager, lazyClientHost) {
    commandManager.register(new commands.ReloadTypeScriptProjectsCommand(lazyClientHost));
    commandManager.register(new commands.ReloadJavaScriptProjectsCommand(lazyClientHost));
    commandManager.register(new commands.SelectTypeScriptVersionCommand(lazyClientHost));
    commandManager.register(new commands.OpenTsServerLogCommand(lazyClientHost));
    commandManager.register(new commands.RestartTsServerCommand(lazyClientHost));
    commandManager.register(new commands.TypeScriptGoToProjectConfigCommand(lazyClientHost));
    commandManager.register(new commands.JavaScriptGoToProjectConfigCommand(lazyClientHost));
}
function isSupportedDocument(supportedLanguage, document) {
    if (supportedLanguage.indexOf(document.languageId) < 0) {
        return false;
    }
    return fileSchemes.isSupportedScheme(document.uri.scheme);
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/extension.js.map
