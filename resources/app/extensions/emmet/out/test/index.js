"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require('path');
const testRunner = require('vscode/lib/testrunner');
const suite = 'Integration Emmet Tests';
const options = {
    ui: 'tdd',
    useColors: true,
    timeout: 60000
};
if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
    options.reporter = 'mocha-multi-reporters';
    options.reporterOptions = {
        reporterEnabled: 'spec, mocha-junit-reporter',
        mochaJunitReporterReporterOptions: {
            testsuitesTitle: `${suite} ${process.platform}`,
            mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
        }
    };
}
testRunner.configure(options);
module.exports = testRunner;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\emmet\out/test\index.js.map
