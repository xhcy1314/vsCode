"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const URL = require("url");
const PathUtils = require("./pathUtilities");
function isWindows(absPath) {
    return /^[a-zA-Z]\:\\/.test(absPath);
}
function stripFirst(path, c) {
    return path[0] === c ? path.substr(1) : path;
}
function stripLast(path, c) {
    return path[path.length - 1] === c ? path.substr(0, path.length - 1) : path;
}
class URI {
    /**
     * Creates a file URI from the given file path.
     * If path is relative, an absolute base path must be provided as well.
     * If base is missing or if base is not absolute, an exception is thrown.
     */
    static file(path, base) {
        if (typeof path !== 'string') {
            throw new Error('string expected');
        }
        if (!PathUtils.isAbsolutePath(path)) {
            if (base) {
                if (PathUtils.isAbsolutePath(base)) {
                    if (isWindows(base)) {
                        path = stripLast(base, '\\') + '\\' + stripFirst(path, '\\');
                    }
                    else {
                        path = stripLast(base, '/') + '/' + stripFirst(path, '/');
                    }
                }
                else {
                    throw new Error('base path not absolute');
                }
                //path = PathUtils.makePathAbsolute(base, path);
            }
            else {
                throw new Error('base path missing');
            }
        }
        if (isWindows(path)) {
            path = path.replace(/\\/g, '/');
        }
        // simplify '/./' -> '/'
        path = path.replace(/\/\.\//g, '/');
        if (path[0] !== '/') {
            path = '/' + path;
        }
        path = encodeURI('file://' + path);
        const u = new URI();
        u._uri = path;
        try {
            u._u = URL.parse(path);
        }
        catch (e) {
            throw new Error(e);
        }
        return u;
    }
    /**
     * Creates a URI from the given string.
     */
    static parse(uri, base) {
        if (uri.indexOf('http:') === 0 || uri.indexOf('https:') === 0 || uri.indexOf('file:') === 0 || uri.indexOf('data:') === 0) {
            const u = new URI();
            u._uri = uri;
            try {
                u._u = URL.parse(uri);
            }
            catch (e) {
                throw new Error(e);
            }
            return u;
        }
        return URI.file(uri, base);
    }
    constructor() {
    }
    uri() {
        return this._uri;
    }
    isFile() {
        return this._u.protocol === 'file:';
    }
    filePath() {
        let path = this._u.path;
        path = decodeURI(path);
        if (/^\/[a-zA-Z]\:\//.test(path)) {
            path = path.substr(1); // remove additional '/'
            path = path.replace(/\//g, '\\'); // convert slashes to backslashes
        }
        return path;
    }
    isData() {
        return this._u.protocol === 'data:' && this._uri.indexOf('application/json') > 0 && this._uri.indexOf('base64') > 0;
    }
    data() {
        const pos = this._uri.lastIndexOf(',');
        if (pos > 0) {
            return this._uri.substr(pos + 1);
        }
        return null;
    }
    isHTTP() {
        return this._u.protocol === 'http:' || this._u.protocol === 'https:';
    }
}
exports.URI = URI;

//# sourceMappingURL=../../out/node/URI.js.map
