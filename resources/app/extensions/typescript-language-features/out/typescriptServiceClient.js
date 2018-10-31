"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const electron = require("./utils/electron");
const wireProtocol_1 = require("./utils/wireProtocol");
const vscode_1 = require("vscode");
const logger_1 = require("./utils/logger");
const is = require("./utils/is");
const telemetry_1 = require("./utils/telemetry");
const tracer_1 = require("./utils/tracer");
const api_1 = require("./utils/api");
const nls = require("vscode-nls");
const configuration_1 = require("./utils/configuration");
const versionProvider_1 = require("./utils/versionProvider");
const versionPicker_1 = require("./utils/versionPicker");
const fileSchemes = require("./utils/fileSchemes");
const tsconfig_1 = require("./utils/tsconfig");
const dispose_1 = require("./utils/dispose");
const diagnostics_1 = require("./features/diagnostics");
const pluginPathsProvider_1 = require("./utils/pluginPathsProvider");
const bufferSyncSupport_1 = require("./features/bufferSyncSupport");
const localize = nls.loadMessageBundle(__filename);
class CallbackMap {
    constructor() {
        this.callbacks = new Map();
        this.asyncCallbacks = new Map();
        this.pendingResponses = 0;
    }
    destroy(e) {
        for (const callback of this.callbacks.values()) {
            callback.e(e);
        }
        for (const callback of this.asyncCallbacks.values()) {
            callback.e(e);
        }
        this.callbacks.clear();
        this.pendingResponses = 0;
    }
    add(seq, callback, isAsync) {
        if (isAsync) {
            this.asyncCallbacks.set(seq, callback);
        }
        else {
            this.callbacks.set(seq, callback);
            ++this.pendingResponses;
        }
    }
    fetch(seq) {
        const callback = this.callbacks.get(seq) || this.asyncCallbacks.get(seq);
        this.delete(seq);
        return callback;
    }
    delete(seq) {
        if (this.callbacks.delete(seq)) {
            --this.pendingResponses;
        }
        else {
            this.asyncCallbacks.delete(seq);
        }
    }
}
class RequestQueue {
    constructor() {
        this.queue = [];
        this.sequenceNumber = 0;
    }
    get length() {
        return this.queue.length;
    }
    push(item) {
        this.queue.push(item);
    }
    shift() {
        return this.queue.shift();
    }
    tryCancelPendingRequest(seq) {
        for (let i = 0; i < this.queue.length; i++) {
            if (this.queue[i].request.seq === seq) {
                this.queue.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    createRequest(command, args) {
        return {
            seq: this.sequenceNumber++,
            type: 'request',
            command: command,
            arguments: args
        };
    }
}
class ForkedTsServerProcess {
    constructor(childProcess) {
        this.childProcess = childProcess;
    }
    onError(cb) {
        this.childProcess.on('error', cb);
    }
    onExit(cb) {
        this.childProcess.on('exit', cb);
    }
    write(serverRequest) {
        this.childProcess.stdin.write(JSON.stringify(serverRequest) + '\r\n', 'utf8');
    }
    createReader(callback, onError) {
        // tslint:disable-next-line:no-unused-expression
        new wireProtocol_1.Reader(this.childProcess.stdout, callback, onError);
    }
    kill() {
        this.childProcess.kill();
    }
}
class TypeScriptServiceClient {
    constructor(workspaceState, onDidChangeTypeScriptVersion, plugins, logDirectoryProvider, allModeIds) {
        this.workspaceState = workspaceState;
        this.onDidChangeTypeScriptVersion = onDidChangeTypeScriptVersion;
        this.plugins = plugins;
        this.logDirectoryProvider = logDirectoryProvider;
        this.logger = new logger_1.default();
        this.tsServerLogFile = null;
        this.isRestarting = false;
        this.cancellationPipeName = null;
        this.disposables = [];
        this._onTsServerStarted = new vscode_1.EventEmitter();
        this.onTsServerStarted = this._onTsServerStarted.event;
        this._onDiagnosticsReceived = new vscode_1.EventEmitter();
        this.onDiagnosticsReceived = this._onDiagnosticsReceived.event;
        this._onConfigDiagnosticsReceived = new vscode_1.EventEmitter();
        this.onConfigDiagnosticsReceived = this._onConfigDiagnosticsReceived.event;
        this._onResendModelsRequested = new vscode_1.EventEmitter();
        this.onResendModelsRequested = this._onResendModelsRequested.event;
        this._onProjectLanguageServiceStateChanged = new vscode_1.EventEmitter();
        this.onProjectLanguageServiceStateChanged = this._onProjectLanguageServiceStateChanged.event;
        this._onDidBeginInstallTypings = new vscode_1.EventEmitter();
        this.onDidBeginInstallTypings = this._onDidBeginInstallTypings.event;
        this._onDidEndInstallTypings = new vscode_1.EventEmitter();
        this.onDidEndInstallTypings = this._onDidEndInstallTypings.event;
        this._onTypesInstallerInitializationFailed = new vscode_1.EventEmitter();
        this.onTypesInstallerInitializationFailed = this._onTypesInstallerInitializationFailed.event;
        this.pathSeparator = path.sep;
        this.lastStart = Date.now();
        var p = new Promise((resolve, reject) => {
            this._onReady = { promise: p, resolve, reject };
        });
        this._onReady.promise = p;
        this.servicePromise = null;
        this.lastError = null;
        this.numberRestarts = 0;
        this.requestQueue = new RequestQueue();
        this.callbacks = new CallbackMap();
        this._configuration = configuration_1.TypeScriptServiceConfiguration.loadFromWorkspace();
        this.versionProvider = new versionProvider_1.TypeScriptVersionProvider(this._configuration);
        this.pluginPathsProvider = new pluginPathsProvider_1.TypeScriptPluginPathsProvider(this._configuration);
        this.versionPicker = new versionPicker_1.TypeScriptVersionPicker(this.versionProvider, this.workspaceState);
        this._apiVersion = api_1.default.defaultVersion;
        this._tsserverVersion = undefined;
        this.tracer = new tracer_1.default(this.logger);
        this.bufferSyncSupport = new bufferSyncSupport_1.default(this, allModeIds);
        this.onReady(() => { this.bufferSyncSupport.listen(); });
        vscode_1.workspace.onDidChangeConfiguration(() => {
            const oldConfiguration = this._configuration;
            this._configuration = configuration_1.TypeScriptServiceConfiguration.loadFromWorkspace();
            this.versionProvider.updateConfiguration(this._configuration);
            this.pluginPathsProvider.updateConfiguration(this._configuration);
            this.tracer.updateConfiguration();
            if (this.servicePromise) {
                if (this._configuration.checkJs !== oldConfiguration.checkJs
                    || this._configuration.experimentalDecorators !== oldConfiguration.experimentalDecorators) {
                    this.setCompilerOptionsForInferredProjects(this._configuration);
                }
                if (!this._configuration.isEqualTo(oldConfiguration)) {
                    this.restartTsServer();
                }
            }
        }, this, this.disposables);
        this.telemetryReporter = new telemetry_1.default(() => this._tsserverVersion || this._apiVersion.versionString);
        this.disposables.push(this.telemetryReporter);
    }
    get configuration() {
        return this._configuration;
    }
    dispose() {
        this.bufferSyncSupport.dispose();
        this._onTsServerStarted.dispose();
        this._onDidBeginInstallTypings.dispose();
        this._onDidEndInstallTypings.dispose();
        this._onTypesInstallerInitializationFailed.dispose();
        if (this.servicePromise) {
            this.servicePromise.then(childProcess => {
                childProcess.kill();
            }).then(undefined, () => void 0);
        }
        dispose_1.disposeAll(this.disposables);
        this._onDiagnosticsReceived.dispose();
        this._onConfigDiagnosticsReceived.dispose();
        this._onResendModelsRequested.dispose();
    }
    restartTsServer() {
        const start = () => {
            this.servicePromise = this.startService(true);
            return this.servicePromise;
        };
        if (this.servicePromise) {
            this.servicePromise = this.servicePromise.then(childProcess => {
                this.info('Killing TS Server');
                this.isRestarting = true;
                childProcess.kill();
                this.resetClientVersion();
            }).then(start);
        }
        else {
            start();
        }
    }
    get apiVersion() {
        return this._apiVersion;
    }
    onReady(f) {
        return this._onReady.promise.then(f);
    }
    info(message, data) {
        this.logger.info(message, data);
    }
    error(message, data) {
        this.logger.error(message, data);
    }
    logTelemetry(eventName, properties) {
        this.telemetryReporter.logTelemetry(eventName, properties);
    }
    service() {
        if (this.servicePromise) {
            return this.servicePromise;
        }
        if (this.lastError) {
            return Promise.reject(this.lastError);
        }
        this.startService();
        if (this.servicePromise) {
            return this.servicePromise;
        }
        return Promise.reject(new Error('Could not create TS service'));
    }
    ensureServiceStarted() {
        if (!this.servicePromise) {
            this.startService();
        }
    }
    startService(resendModels = false) {
        let currentVersion = this.versionPicker.currentVersion;
        this.info(`Using tsserver from: ${currentVersion.path}`);
        if (!fs.existsSync(currentVersion.tsServerPath)) {
            vscode_1.window.showWarningMessage(localize(0, null, currentVersion.path));
            this.versionPicker.useBundledVersion();
            currentVersion = this.versionPicker.currentVersion;
        }
        this._apiVersion = this.versionPicker.currentVersion.version || api_1.default.defaultVersion;
        this.onDidChangeTypeScriptVersion(currentVersion);
        this.requestQueue = new RequestQueue();
        this.callbacks = new CallbackMap();
        this.lastError = null;
        return this.servicePromise = new Promise(async (resolve, reject) => {
            try {
                const tsServerForkArgs = await this.getTsServerArgs(currentVersion);
                const debugPort = this.getDebugPort();
                const tsServerForkOptions = {
                    execArgv: debugPort ? [`--inspect=${debugPort}`] : [] // [`--debug-brk=5859`]
                };
                electron.fork(currentVersion.tsServerPath, tsServerForkArgs, tsServerForkOptions, this.logger, (err, childProcess) => {
                    if (err || !childProcess) {
                        this.lastError = err;
                        this.error('Starting TSServer failed with error.', err);
                        vscode_1.window.showErrorMessage(localize(1, null, err.message || err));
                        /* __GDPR__
                            "error" : {
                                "${include}": [
                                    "${TypeScriptCommonProperties}"
                                ]
                            }
                        */
                        this.logTelemetry('error');
                        this.resetClientVersion();
                        return;
                    }
                    this.info('Started TSServer');
                    const handle = new ForkedTsServerProcess(childProcess);
                    this.lastStart = Date.now();
                    handle.onError((err) => {
                        this.lastError = err;
                        this.error('TSServer errored with error.', err);
                        if (this.tsServerLogFile) {
                            this.error(`TSServer log file: ${this.tsServerLogFile}`);
                        }
                        /* __GDPR__
                            "tsserver.error" : {
                                "${include}": [
                                    "${TypeScriptCommonProperties}"
                                ]
                            }
                        */
                        this.logTelemetry('tsserver.error');
                        this.serviceExited(false);
                    });
                    handle.onExit((code) => {
                        if (code === null || typeof code === 'undefined') {
                            this.info('TSServer exited');
                        }
                        else {
                            this.error(`TSServer exited with code: ${code}`);
                            /* __GDPR__
                                "tsserver.exitWithCode" : {
                                    "code" : { "classification": "CallstackOrException", "purpose": "PerformanceAndHealth" },
                                    "${include}": [
                                        "${TypeScriptCommonProperties}"
                                    ]
                                }
                            */
                            this.logTelemetry('tsserver.exitWithCode', { code: code });
                        }
                        if (this.tsServerLogFile) {
                            this.info(`TSServer log file: ${this.tsServerLogFile}`);
                        }
                        this.serviceExited(!this.isRestarting);
                        this.isRestarting = false;
                    });
                    handle.createReader(msg => { this.dispatchMessage(msg); }, error => { this.error('ReaderError', error); });
                    this._onReady.resolve();
                    resolve(handle);
                    this._onTsServerStarted.fire(currentVersion.version);
                    this.serviceStarted(resendModels);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    onVersionStatusClicked() {
        return this.showVersionPicker(false);
    }
    showVersionPicker(firstRun) {
        return this.versionPicker.show(firstRun).then(change => {
            if (firstRun || !change.newVersion || !change.oldVersion || change.oldVersion.path === change.newVersion.path) {
                return;
            }
            this.restartTsServer();
        });
    }
    async openTsServerLogFile() {
        if (!this.apiVersion.gte(api_1.default.v222)) {
            vscode_1.window.showErrorMessage(localize(2, null));
            return false;
        }
        if (this._configuration.tsServerLogLevel === configuration_1.TsServerLogLevel.Off) {
            vscode_1.window.showErrorMessage(localize(3, null), {
                title: localize(4, null),
            })
                .then(selection => {
                if (selection) {
                    return vscode_1.workspace.getConfiguration().update('typescript.tsserver.log', 'verbose', true).then(() => {
                        this.restartTsServer();
                    });
                }
                return undefined;
            });
            return false;
        }
        if (!this.tsServerLogFile) {
            vscode_1.window.showWarningMessage(localize(5, null));
            return false;
        }
        try {
            await vscode_1.commands.executeCommand('revealFileInOS', vscode_1.Uri.parse(this.tsServerLogFile));
            return true;
        }
        catch (_a) {
            vscode_1.window.showWarningMessage(localize(6, null));
            return false;
        }
    }
    serviceStarted(resendModels) {
        const configureOptions = {
            hostInfo: 'vscode'
        };
        this.execute('configure', configureOptions);
        this.setCompilerOptionsForInferredProjects(this._configuration);
        if (resendModels) {
            this._onResendModelsRequested.fire();
        }
    }
    setCompilerOptionsForInferredProjects(configuration) {
        if (!this.apiVersion.gte(api_1.default.v206)) {
            return;
        }
        const args = {
            options: this.getCompilerOptionsForInferredProjects(configuration)
        };
        this.execute('compilerOptionsForInferredProjects', args, true);
    }
    getCompilerOptionsForInferredProjects(configuration) {
        return Object.assign({}, tsconfig_1.inferredProjectConfig(configuration), { allowJs: true, allowSyntheticDefaultImports: true, allowNonTsExtensions: true });
    }
    serviceExited(restart) {
        let MessageAction;
        (function (MessageAction) {
            MessageAction[MessageAction["reportIssue"] = 0] = "reportIssue";
        })(MessageAction || (MessageAction = {}));
        this.servicePromise = null;
        this.tsServerLogFile = null;
        this.callbacks.destroy(new Error('Service died.'));
        this.callbacks = new CallbackMap();
        if (!restart) {
            this.resetClientVersion();
        }
        else {
            const diff = Date.now() - this.lastStart;
            this.numberRestarts++;
            let startService = true;
            if (this.numberRestarts > 5) {
                let prompt = undefined;
                this.numberRestarts = 0;
                if (diff < 10 * 1000 /* 10 seconds */) {
                    this.lastStart = Date.now();
                    startService = false;
                    prompt = vscode_1.window.showErrorMessage(localize(7, null), {
                        title: localize(8, null),
                        id: MessageAction.reportIssue
                    });
                    /* __GDPR__
                        "serviceExited" : {
                            "${include}": [
                                "${TypeScriptCommonProperties}"
                            ]
                        }
                    */
                    this.logTelemetry('serviceExited');
                    this.resetClientVersion();
                }
                else if (diff < 60 * 1000 /* 1 Minutes */) {
                    this.lastStart = Date.now();
                    prompt = vscode_1.window.showWarningMessage(localize(9, null), {
                        title: localize(10, null),
                        id: MessageAction.reportIssue
                    });
                }
                if (prompt) {
                    prompt.then(item => {
                        if (item && item.id === MessageAction.reportIssue) {
                            return vscode_1.commands.executeCommand('workbench.action.reportIssues');
                        }
                        return undefined;
                    });
                }
            }
            if (startService) {
                this.startService(true);
            }
        }
    }
    normalizedPath(resource) {
        if (this._apiVersion.gte(api_1.default.v213)) {
            if (resource.scheme === fileSchemes.walkThroughSnippet || resource.scheme === fileSchemes.untitled) {
                const dirName = path.dirname(resource.path);
                const fileName = this.inMemoryResourcePrefix + path.basename(resource.path);
                return resource.with({ path: path.posix.join(dirName, fileName) }).toString(true);
            }
        }
        if (resource.scheme !== fileSchemes.file) {
            return null;
        }
        const result = resource.fsPath;
        if (!result) {
            return null;
        }
        // Both \ and / must be escaped in regular expressions
        return result.replace(new RegExp('\\' + this.pathSeparator, 'g'), '/');
    }
    toPath(resource) {
        return this.normalizedPath(resource);
    }
    get inMemoryResourcePrefix() {
        return this._apiVersion.gte(api_1.default.v270) ? '^' : '';
    }
    toResource(filepath) {
        if (this._apiVersion.gte(api_1.default.v213)) {
            if (filepath.startsWith(TypeScriptServiceClient.WALK_THROUGH_SNIPPET_SCHEME_COLON) || (filepath.startsWith(fileSchemes.untitled + ':'))) {
                let resource = vscode_1.Uri.parse(filepath);
                if (this.inMemoryResourcePrefix) {
                    const dirName = path.dirname(resource.path);
                    const fileName = path.basename(resource.path);
                    if (fileName.startsWith(this.inMemoryResourcePrefix)) {
                        resource = resource.with({ path: path.posix.join(dirName, fileName.slice(this.inMemoryResourcePrefix.length)) });
                    }
                }
                return resource;
            }
        }
        return this.bufferSyncSupport.toResource(filepath);
    }
    getWorkspaceRootForResource(resource) {
        const roots = vscode_1.workspace.workspaceFolders;
        if (!roots || !roots.length) {
            return undefined;
        }
        if (resource.scheme === fileSchemes.file || resource.scheme === fileSchemes.untitled) {
            for (const root of roots.sort((a, b) => a.uri.fsPath.length - b.uri.fsPath.length)) {
                if (resource.fsPath.startsWith(root.uri.fsPath + path.sep)) {
                    return root.uri.fsPath;
                }
            }
            return roots[0].uri.fsPath;
        }
        return undefined;
    }
    executeAsync(command, args, token) {
        return this.executeImpl(command, args, { isAsync: true, token, expectsResult: true });
    }
    execute(command, args, expectsResultOrToken) {
        let token = undefined;
        let expectsResult = true;
        if (typeof expectsResultOrToken === 'boolean') {
            expectsResult = expectsResultOrToken;
        }
        else {
            token = expectsResultOrToken;
        }
        return this.executeImpl(command, args, { isAsync: false, token, expectsResult });
    }
    executeImpl(command, args, executeInfo) {
        const request = this.requestQueue.createRequest(command, args);
        const requestInfo = {
            request: request,
            callbacks: null,
            isAsync: executeInfo.isAsync
        };
        let result;
        if (executeInfo.expectsResult) {
            let wasCancelled = false;
            result = new Promise((resolve, reject) => {
                requestInfo.callbacks = { c: resolve, e: reject, start: Date.now() };
                if (executeInfo.token) {
                    executeInfo.token.onCancellationRequested(() => {
                        wasCancelled = true;
                        this.tryCancelRequest(request.seq);
                    });
                }
            }).catch((err) => {
                if (!wasCancelled) {
                    this.error(`'${command}' request failed with error.`, err);
                    const properties = this.parseErrorText(err && err.message, command);
                    this.logTelemetry('languageServiceErrorResponse', properties);
                }
                throw err;
            });
        }
        else {
            result = Promise.resolve(null);
        }
        this.requestQueue.push(requestInfo);
        this.sendNextRequests();
        return result;
    }
    /**
     * Given a `errorText` from a tsserver request indicating failure in handling a request,
     * prepares a payload for telemetry-logging.
     */
    parseErrorText(errorText, command) {
        const properties = Object.create(null);
        properties['command'] = command;
        if (errorText) {
            properties['errorText'] = errorText;
            const errorPrefix = 'Error processing request. ';
            if (errorText.startsWith(errorPrefix)) {
                const prefixFreeErrorText = errorText.substr(errorPrefix.length);
                const newlineIndex = prefixFreeErrorText.indexOf('\n');
                if (newlineIndex >= 0) {
                    // Newline expected between message and stack.
                    properties['message'] = prefixFreeErrorText.substring(0, newlineIndex);
                    properties['stack'] = prefixFreeErrorText.substring(newlineIndex + 1);
                }
            }
        }
        return properties;
    }
    sendNextRequests() {
        while (this.callbacks.pendingResponses === 0 && this.requestQueue.length > 0) {
            const item = this.requestQueue.shift();
            if (item) {
                this.sendRequest(item);
            }
        }
    }
    sendRequest(requestItem) {
        const serverRequest = requestItem.request;
        this.tracer.traceRequest(serverRequest, !!requestItem.callbacks, this.requestQueue.length);
        if (requestItem.callbacks) {
            this.callbacks.add(serverRequest.seq, requestItem.callbacks, requestItem.isAsync);
        }
        this.service()
            .then((childProcess) => {
            childProcess.write(serverRequest);
        })
            .then(undefined, err => {
            const callback = this.callbacks.fetch(serverRequest.seq);
            if (callback) {
                callback.e(err);
            }
        });
    }
    tryCancelRequest(seq) {
        try {
            if (this.requestQueue.tryCancelPendingRequest(seq)) {
                this.tracer.logTrace(`TypeScript Service: canceled request with sequence number ${seq}`);
                return true;
            }
            if (this.apiVersion.gte(api_1.default.v222) && this.cancellationPipeName) {
                this.tracer.logTrace(`TypeScript Service: trying to cancel ongoing request with sequence number ${seq}`);
                try {
                    fs.writeFileSync(this.cancellationPipeName + seq, '');
                }
                catch (_a) {
                    // noop
                }
                return true;
            }
            this.tracer.logTrace(`TypeScript Service: tried to cancel request with sequence number ${seq}. But request got already delivered.`);
            return false;
        }
        finally {
            const p = this.callbacks.fetch(seq);
            if (p) {
                p.e(new Error(`Cancelled Request ${seq}`));
            }
        }
    }
    dispatchMessage(message) {
        try {
            if (message.type === 'response') {
                const response = message;
                const p = this.callbacks.fetch(response.request_seq);
                if (p) {
                    this.tracer.traceResponse(response, p.start);
                    if (response.success) {
                        p.c(response);
                    }
                    else {
                        p.e(response);
                    }
                }
            }
            else if (message.type === 'event') {
                const event = message;
                this.tracer.traceEvent(event);
                this.dispatchEvent(event);
            }
            else {
                throw new Error('Unknown message type ' + message.type + ' received');
            }
        }
        finally {
            this.sendNextRequests();
        }
    }
    dispatchEvent(event) {
        switch (event.event) {
            case 'requestCompleted':
                const seq = event.body.request_seq;
                const p = this.callbacks.fetch(seq);
                if (p) {
                    this.tracer.traceRequestCompleted('requestCompleted', seq, p.start);
                    p.c(undefined);
                }
                break;
            case 'syntaxDiag':
            case 'semanticDiag':
            case 'suggestionDiag':
                const diagnosticEvent = event;
                if (diagnosticEvent.body && diagnosticEvent.body.diagnostics) {
                    this._onDiagnosticsReceived.fire({
                        kind: getDignosticsKind(event),
                        resource: this.toResource(diagnosticEvent.body.file),
                        diagnostics: diagnosticEvent.body.diagnostics
                    });
                }
                break;
            case 'configFileDiag':
                this._onConfigDiagnosticsReceived.fire(event);
                break;
            case 'telemetry':
                const telemetryData = event.body;
                this.dispatchTelemetryEvent(telemetryData);
                break;
            case 'projectLanguageServiceState':
                if (event.body) {
                    this._onProjectLanguageServiceStateChanged.fire(event.body);
                }
                break;
            case 'projectsUpdatedInBackground':
                if (event.body) {
                    const body = event.body;
                    const resources = body.openFiles.map(vscode_1.Uri.file);
                    this.bufferSyncSupport.getErr(resources);
                }
                break;
            case 'beginInstallTypes':
                if (event.body) {
                    this._onDidBeginInstallTypings.fire(event.body);
                }
                break;
            case 'endInstallTypes':
                if (event.body) {
                    this._onDidEndInstallTypings.fire(event.body);
                }
                break;
            case 'typesInstallerInitializationFailed':
                if (event.body) {
                    this._onTypesInstallerInitializationFailed.fire(event.body);
                }
                break;
        }
    }
    dispatchTelemetryEvent(telemetryData) {
        const properties = Object.create(null);
        switch (telemetryData.telemetryEventName) {
            case 'typingsInstalled':
                const typingsInstalledPayload = telemetryData.payload;
                properties['installedPackages'] = typingsInstalledPayload.installedPackages;
                if (is.defined(typingsInstalledPayload.installSuccess)) {
                    properties['installSuccess'] = typingsInstalledPayload.installSuccess.toString();
                }
                if (is.string(typingsInstalledPayload.typingsInstallerVersion)) {
                    properties['typingsInstallerVersion'] = typingsInstalledPayload.typingsInstallerVersion;
                }
                break;
            default:
                const payload = telemetryData.payload;
                if (payload) {
                    Object.keys(payload).forEach((key) => {
                        try {
                            if (payload.hasOwnProperty(key)) {
                                properties[key] = is.string(payload[key]) ? payload[key] : JSON.stringify(payload[key]);
                            }
                        }
                        catch (e) {
                            // noop
                        }
                    });
                }
                break;
        }
        if (telemetryData.telemetryEventName === 'projectInfo') {
            this._tsserverVersion = properties['version'];
        }
        /* __GDPR__
            "typingsInstalled" : {
                "installedPackages" : { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
                "installSuccess": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" },
                "typingsInstallerVersion": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" },
                "${include}": [
                    "${TypeScriptCommonProperties}"
                ]
            }
        */
        // __GDPR__COMMENT__: Other events are defined by TypeScript.
        this.logTelemetry(telemetryData.telemetryEventName, properties);
    }
    async getTsServerArgs(currentVersion) {
        const args = [];
        if (this.apiVersion.gte(api_1.default.v206)) {
            if (this.apiVersion.gte(api_1.default.v250)) {
                args.push('--useInferredProjectPerProjectRoot');
            }
            else {
                args.push('--useSingleInferredProject');
            }
            if (this._configuration.disableAutomaticTypeAcquisition) {
                args.push('--disableAutomaticTypingAcquisition');
            }
        }
        if (this.apiVersion.gte(api_1.default.v208)) {
            args.push('--enableTelemetry');
        }
        if (this.apiVersion.gte(api_1.default.v222)) {
            this.cancellationPipeName = electron.getTempSock('tscancellation');
            args.push('--cancellationPipeName', this.cancellationPipeName + '*');
        }
        if (this.apiVersion.gte(api_1.default.v222)) {
            if (this._configuration.tsServerLogLevel !== configuration_1.TsServerLogLevel.Off) {
                const logDir = await this.logDirectoryProvider.getNewLogDirectory();
                if (logDir) {
                    this.tsServerLogFile = path.join(logDir, `tsserver.log`);
                    this.info(`TSServer log file: ${this.tsServerLogFile}`);
                }
                else {
                    this.tsServerLogFile = null;
                    this.error('Could not create TSServer log directory');
                }
                if (this.tsServerLogFile) {
                    args.push('--logVerbosity', configuration_1.TsServerLogLevel.toString(this._configuration.tsServerLogLevel));
                    args.push('--logFile', this.tsServerLogFile);
                }
            }
        }
        if (this.apiVersion.gte(api_1.default.v230)) {
            const pluginPaths = this.pluginPathsProvider.getPluginPaths();
            if (this.plugins.length) {
                args.push('--globalPlugins', this.plugins.map(x => x.name).join(','));
                if (currentVersion.path === this.versionProvider.defaultVersion.path) {
                    pluginPaths.push(...this.plugins.map(x => x.path));
                }
            }
            if (pluginPaths.length !== 0) {
                args.push('--pluginProbeLocations', pluginPaths.join(','));
            }
        }
        if (this.apiVersion.gte(api_1.default.v234)) {
            if (this._configuration.npmLocation) {
                args.push('--npmLocation', `"${this._configuration.npmLocation}"`);
            }
        }
        if (this.apiVersion.gte(api_1.default.v260)) {
            const tsLocale = getTsLocale(this._configuration);
            if (tsLocale) {
                args.push('--locale', tsLocale);
            }
        }
        if (this.apiVersion.gte(api_1.default.v291)) {
            args.push('--noGetErrOnBackgroundUpdate');
        }
        return args;
    }
    getDebugPort() {
        const value = process.env['TSS_DEBUG'];
        if (value) {
            const port = parseInt(value);
            if (!isNaN(port)) {
                return port;
            }
        }
        return undefined;
    }
    resetClientVersion() {
        this._apiVersion = api_1.default.defaultVersion;
        this._tsserverVersion = undefined;
    }
}
TypeScriptServiceClient.WALK_THROUGH_SNIPPET_SCHEME_COLON = `${fileSchemes.walkThroughSnippet}:`;
exports.default = TypeScriptServiceClient;
const getTsLocale = (configuration) => (configuration.locale
    ? configuration.locale
    : vscode_1.env.language);
function getDignosticsKind(event) {
    switch (event.event) {
        case 'syntaxDiag': return diagnostics_1.DiagnosticKind.Syntax;
        case 'semanticDiag': return diagnostics_1.DiagnosticKind.Semantic;
        case 'suggestionDiag': return diagnostics_1.DiagnosticKind.Suggestion;
    }
    throw new Error('Unknown dignostics kind');
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\typescript-language-features\out/typescriptServiceClient.js.map
