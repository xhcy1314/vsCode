/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const configurationProvider_1 = require("./configurationProvider");
const loadedScripts_1 = require("./loadedScripts");
const processPicker_1 = require("./processPicker");
const cluster_1 = require("./cluster");
const autoAttach_1 = require("./autoAttach");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
function activate(context) {
    // register a configuration provider
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('node', new configurationProvider_1.NodeConfigurationProvider(context)));
    // toggle skipping file action
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.toggleSkippingFile', toggleSkippingFile));
    // process picker command
    context.subscriptions.push(vscode.commands.registerCommand('extension.pickNodeProcess', processPicker_1.pickProcess));
    // attach process command
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.attachNodeProcess', processPicker_1.attachProcess));
    // loaded scripts
    vscode.window.registerTreeDataProvider('extension.node-debug.loadedScriptsExplorer', new loadedScripts_1.LoadedScriptsProvider(context));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.pickLoadedScript', loadedScripts_1.pickLoadedScript));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.openScript', (session, source) => loadedScripts_1.openScript(session, source)));
    // cluster
    context.subscriptions.push(vscode.debug.onDidStartDebugSession(session => cluster_1.Cluster.startSession(session)));
    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => cluster_1.Cluster.stopSession(session)));
    // auto attach in terminal
    const onText = localize(0, null);
    const offText = localize(1, null);
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusItem.command = 'extension.node-debug.toggleAutoAttach';
    statusItem.text = offText;
    statusItem.tooltip = localize(2, null);
    statusItem.show();
    context.subscriptions.push(statusItem);
    const rootPid = parseInt(process.env['VSCODE_PID']);
    let autoAttacher;
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.toggleAutoAttach', _ => {
        if (autoAttacher) {
            statusItem.text = offText;
            autoAttacher.dispose();
            autoAttacher = undefined;
        }
        else {
            statusItem.text = onText;
            autoAttacher = autoAttach_1.startAutoAttach(rootPid);
        }
    }));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//---- toggle skipped files
function toggleSkippingFile(res) {
    let resource = res;
    if (!resource) {
        const activeEditor = vscode.window.activeTextEditor;
        resource = activeEditor && activeEditor.document.fileName;
    }
    if (resource && vscode.debug.activeDebugSession) {
        const args = typeof resource === 'string' ? { resource } : { sourceReference: resource };
        vscode.debug.activeDebugSession.customRequest('toggleSkipFileStatus', args);
    }
}

//# sourceMappingURL=../../../out/node/extension/extension.js.map
