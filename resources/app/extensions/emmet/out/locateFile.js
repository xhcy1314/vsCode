/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Based on @sergeche's work on the emmet plugin for atom
// TODO: Move to https://github.com/emmetio/file-utils
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const reAbsolutePosix = /^\/+/;
const reAbsoluteWin32 = /^\\+/;
const reAbsolute = path.sep === '/' ? reAbsolutePosix : reAbsoluteWin32;
/**
 * Locates given `filePath` on user’s file system and returns absolute path to it.
 * This method expects either URL, or relative/absolute path to resource
 * @param basePath Base path to use if filePath is not absoulte
 * @param filePath File to locate.
 */
function locateFile(base, filePath) {
    if (/^\w+:/.test(filePath)) {
        // path with protocol, already absolute
        return Promise.resolve(filePath);
    }
    filePath = path.normalize(filePath);
    return reAbsolute.test(filePath)
        ? resolveAbsolute(base, filePath)
        : resolveRelative(base, filePath);
}
exports.locateFile = locateFile;
/**
 * Resolves relative file path
 */
function resolveRelative(basePath, filePath) {
    return tryFile(path.resolve(basePath, filePath));
}
/**
 * Resolves absolute file path agaist given editor: tries to find file in every
 * parent of editor’s file
 */
function resolveAbsolute(basePath, filePath) {
    return new Promise((resolve, reject) => {
        filePath = filePath.replace(reAbsolute, '');
        const next = (ctx) => {
            tryFile(path.resolve(ctx, filePath))
                .then(resolve, err => {
                const dir = path.dirname(ctx);
                if (!dir || dir === ctx) {
                    return reject(`Unable to locate absolute file ${filePath}`);
                }
                next(dir);
            });
        };
        next(basePath);
    });
}
/**
 * Check if given file exists and it’s a file, not directory
 */
function tryFile(file) {
    return new Promise((resolve, reject) => {
        fs.stat(file, (err, stat) => {
            if (err) {
                return reject(err);
            }
            if (!stat.isFile()) {
                return reject(new Error(`${file} is not a file`));
            }
            resolve(file);
        });
    });
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\emmet\out/locateFile.js.map
