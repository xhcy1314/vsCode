/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
const nodeProcessTree_1 = require("./nodeProcessTree");
const localize = nls.loadMessageBundle(__filename);
class Cluster {
    constructor(_folder, _config) {
        this._folder = _folder;
        this._config = _config;
    }
    static prepareAutoAttachChildProcesses(folder, config) {
        this.clusters.set(config.name, new Cluster(folder, config));
    }
    static startSession(session) {
        const cluster = this.clusters.get(session.name);
        if (cluster) {
            cluster.startWatching(session);
        }
    }
    static stopSession(session) {
        const cluster = this.clusters.get(session.name);
        if (cluster) {
            cluster.stopWatching();
            this.clusters.delete(session.name);
        }
    }
    startWatching(session) {
        setTimeout(_ => {
            // get the process ID from the debuggee
            if (session) {
                session.customRequest('evaluate', { expression: 'process.pid' }).then(reply => {
                    const rootPid = parseInt(reply.result);
                    this.attachChildProcesses(rootPid);
                }, e => {
                    // 'evaluate' error -> use the fall back strategy
                    this.attachChildProcesses(NaN);
                });
            }
        }, session.type === 'node2' ? 500 : 100);
    }
    stopWatching() {
        if (this.poller) {
            this.poller.dispose();
            this.poller = undefined;
        }
    }
    attachChildProcesses(rootPid) {
        this.poller = nodeProcessTree_1.pollProcesses(rootPid, false, (pid, cmd, args) => {
            const name = localize(0, null, pid);
            nodeProcessTree_1.attachToProcess(this._folder, name, pid, args, this._config);
        });
    }
}
Cluster.clusters = new Map();
exports.Cluster = Cluster;

//# sourceMappingURL=../../../out/node/extension/cluster.js.map
