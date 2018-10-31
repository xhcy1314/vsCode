/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
const path_1 = require("path");
const nodeProcessTree_1 = require("./nodeProcessTree");
const localize = nls.loadMessageBundle(__filename);
function startAutoAttach(rootPid) {
    return nodeProcessTree_1.pollProcesses(rootPid, true, (pid, cmdPath, args) => {
        const cmdName = path_1.basename(cmdPath, '.exe');
        if (cmdName === 'node') {
            const name = localize(0, null, pid);
            nodeProcessTree_1.attachToProcess(undefined, name, pid, args);
        }
    });
}
exports.startAutoAttach = startAutoAttach;

//# sourceMappingURL=../../../out/node/extension/autoAttach.js.map
