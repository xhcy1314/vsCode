"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Path = require("path");
const FS = require("fs");
const CRYPTO = require("crypto");
const OS = require("os");
const XHR = require("request-light");
const SM = require("source-map");
const PathUtils = require("./pathUtilities");
const URI_1 = require("./URI");
const util = require('../../node_modules/source-map/lib/util.js');
var Bias;
(function (Bias) {
    Bias[Bias["GREATEST_LOWER_BOUND"] = 1] = "GREATEST_LOWER_BOUND";
    Bias[Bias["LEAST_UPPER_BOUND"] = 2] = "LEAST_UPPER_BOUND";
})(Bias = exports.Bias || (exports.Bias = {}));
class SourceMaps {
    constructor(session, generatedCodeDirectory, generatedCodeGlobs) {
        this._sourceMapCache = new Map(); // all cached source maps
        this._generatedToSourceMaps = new Map(); // generated file -> SourceMap
        this._sourceToGeneratedMaps = new Map(); // source file -> SourceMap
        this._session = session;
        generatedCodeGlobs = generatedCodeGlobs || [];
        if (generatedCodeDirectory) {
            generatedCodeGlobs.push(generatedCodeDirectory + '/**/*.js'); // backward compatibility: turn old outDir into a glob pattern
        }
        // try to find all source files upfront asynchroneously
        if (generatedCodeGlobs.length > 0) {
            this._preLoad = PathUtils.multiGlob(generatedCodeGlobs).then(paths => {
                return Promise.all(paths.map(path => {
                    return this._findSourceMapUrlInFile(path).then(uri => {
                        return this._getSourceMap(uri, path);
                    }).catch(err => {
                        return null;
                    });
                })).then(results => {
                    return void 0;
                }).catch(err => {
                    // silently ignore errors
                    return void 0;
                });
            });
        }
        else {
            this._preLoad = Promise.resolve(void 0);
        }
    }
    MapPathFromSource(pathToSource) {
        return this._preLoad.then(() => {
            return this._findSourceToGeneratedMapping(pathToSource).then(map => {
                return map ? map.generatedPath() : null;
            });
        });
    }
    MapFromSource(pathToSource, line, column, bias) {
        return this._preLoad.then(() => {
            return this._findSourceToGeneratedMapping(pathToSource).then(map => {
                if (map) {
                    line += 1; // source map impl is 1 based
                    const mr = map.generatedPositionFor(pathToSource, line, column, bias);
                    if (mr && mr.line !== null && mr.column !== null) {
                        return {
                            path: map.generatedPath(),
                            line: mr.line - 1,
                            column: mr.column
                        };
                    }
                }
                return null;
            });
        });
    }
    MapToSource(pathToGenerated, content, line, column) {
        return this._preLoad.then(() => {
            return this._findGeneratedToSourceMapping(pathToGenerated, content).then(map => {
                if (map) {
                    line += 1; // source map impl is 1 based
                    let mr = map.originalPositionFor(line, column, Bias.GREATEST_LOWER_BOUND);
                    if (!mr) {
                        mr = map.originalPositionFor(line, column, Bias.LEAST_UPPER_BOUND);
                    }
                    if (mr && mr.source && mr.line !== null && mr.column !== null) {
                        return {
                            path: mr.source,
                            content: mr.content,
                            line: mr.line - 1,
                            column: mr.column
                        };
                    }
                }
                return null;
            });
        });
    }
    //---- private -----------------------------------------------------------------------
    /**
     * Tries to find a SourceMap for the given source.
     * This is a bit tricky because the source does not contain any information about where
     * the generated code or the source map is located.
     * The code relies on the source cache populated by the exhaustive search over the 'outFiles' glob patterns
     * and some heuristics.
     */
    _findSourceToGeneratedMapping(pathToSource) {
        if (!pathToSource) {
            return Promise.resolve(null);
        }
        // try to find in cache by source path
        const pathToSourceKey = PathUtils.pathNormalize(pathToSource);
        const map = this._sourceToGeneratedMaps.get(pathToSourceKey);
        if (map) {
            return Promise.resolve(map);
        }
        let pathToGenerated = pathToSource;
        return Promise.resolve(null).then(map => {
            // heuristic: try to find the generated code side by side to the source
            const ext = Path.extname(pathToSource);
            if (ext !== '.js') {
                // use heuristic: change extension to ".js" and find a map for it
                const pos = pathToSource.lastIndexOf('.');
                if (pos >= 0) {
                    pathToGenerated = pathToSource.substr(0, pos) + '.js';
                    return this._findGeneratedToSourceMapping(pathToGenerated);
                }
            }
            return map;
        }).then(map => {
            if (!map) {
                // heuristic for VSCode extension host support:
                // we know that the plugin has an "out" directory next to the "src" directory
                // TODO: get rid of this and use glob patterns instead
                if (!map) {
                    let srcSegment = Path.sep + 'src' + Path.sep;
                    if (pathToGenerated.indexOf(srcSegment) >= 0) {
                        const outSegment = Path.sep + 'out' + Path.sep;
                        return this._findGeneratedToSourceMapping(pathToGenerated.replace(srcSegment, outSegment));
                    }
                }
            }
            return map;
        }).then(map => {
            if (map) {
                // remember found map for source key
                this._sourceToGeneratedMaps.set(pathToSourceKey, map);
            }
            return map;
        });
    }
    /**
     * Tries to find a SourceMap for the given path to a generated file.
     * This is simple if the generated file has the 'sourceMappingURL' at the end.
     * If not, we are using some heuristics...
     */
    _findGeneratedToSourceMapping(pathToGenerated, content) {
        if (!pathToGenerated) {
            return Promise.resolve(null);
        }
        const pathToGeneratedKey = PathUtils.pathNormalize(pathToGenerated);
        const map = this._generatedToSourceMaps.get(pathToGeneratedKey);
        if (map) {
            return Promise.resolve(map);
        }
        // try to find a source map URL in the generated file
        return this._findSourceMapUrlInFile(pathToGenerated, content).then(uri => {
            if (uri) {
                return this._getSourceMap(uri, pathToGenerated);
            }
            // heuristic: try to find map file side-by-side to the generated source
            let map_path = pathToGenerated + '.map';
            if (FS.existsSync(map_path)) {
                return this._getSourceMap(URI_1.URI.file(map_path), pathToGenerated);
            }
            return Promise.resolve(null);
        });
    }
    /**
     * Try to find the 'sourceMappingURL' in content or the file with the given path.
     * Returns null if no source map url is found or if an error occured.
     */
    _findSourceMapUrlInFile(pathToGenerated, content) {
        if (content) {
            return Promise.resolve(this._findSourceMapUrl(content, pathToGenerated));
        }
        return this._readFile(pathToGenerated).then(content => {
            return this._findSourceMapUrl(content, pathToGenerated);
        }).catch(err => {
            return null;
        });
    }
    /**
     * Try to find the 'sourceMappingURL' at the end of the given contents.
     * Relative file paths are converted into absolute paths.
     * Returns null if no source map url is found.
     */
    _findSourceMapUrl(contents, pathToGenerated) {
        const lines = contents.split('\n');
        for (let l = lines.length - 1; l >= Math.max(lines.length - 10, 0); l--) {
            const line = lines[l].trim();
            const matches = SourceMaps.SOURCE_MAPPING_MATCHER.exec(line);
            if (matches && matches.length === 2) {
                let uri = matches[1].trim();
                if (pathToGenerated) {
                    this._log(`_findSourceMapUrl: source map url found at end of generated file '${pathToGenerated}'`);
                    return URI_1.URI.parse(uri, Path.dirname(pathToGenerated));
                }
                else {
                    this._log(`_findSourceMapUrl: source map url found at end of generated content`);
                    return URI_1.URI.parse(uri);
                }
            }
        }
        return null;
    }
    /**
     * Returns a (cached) SourceMap specified via the given uri.
     */
    _getSourceMap(uri, pathToGenerated) {
        if (!uri) {
            return Promise.resolve(null);
        }
        // use sha256 to ensure the hash value can be used in filenames
        const hash = CRYPTO.createHash('sha256').update(uri.uri()).digest('hex');
        let promise = this._sourceMapCache.get(hash);
        if (promise) {
            return promise;
        }
        try {
            const prom = this._loadSourceMap(uri, pathToGenerated, hash);
            this._sourceMapCache.set(hash, prom);
            return prom;
        }
        catch (err) {
            this._log(`_loadSourceMap: loading source map '${uri.uri()}' failed with exception: ${err}`);
            return Promise.resolve(null);
        }
    }
    /**
     * Loads a SourceMap specified by the given uri.
     */
    _loadSourceMap(uri, pathToGenerated, hash) {
        if (uri.isFile()) {
            const map_path = uri.filePath();
            return this._readFile(map_path).then(content => {
                return this._registerSourceMap(new SourceMap(map_path, pathToGenerated, content));
            });
        }
        if (uri.isData()) {
            const data = uri.data();
            if (data) {
                try {
                    const buffer = new Buffer(data, 'base64');
                    const json = buffer.toString();
                    if (json) {
                        return Promise.resolve(this._registerSourceMap(new SourceMap(pathToGenerated, pathToGenerated, json)));
                    }
                }
                catch (e) {
                    throw new Error(`exception while processing data url`);
                }
            }
            throw new Error(`exception while processing data url`);
        }
        if (uri.isHTTP()) {
            const cache_path = Path.join(OS.tmpdir(), 'com.microsoft.VSCode', 'node-debug', 'sm-cache');
            const path = Path.join(cache_path, hash);
            return Promise.resolve(FS.existsSync(path)).then(exists => {
                if (exists) {
                    return this._readFile(path).then(content => {
                        return this._registerSourceMap(new SourceMap(pathToGenerated, pathToGenerated, content));
                    });
                }
                const options = {
                    url: uri.uri(),
                    followRedirects: 5
                };
                return XHR.xhr(options).then(response => {
                    return this._writeFile(path, response.responseText).then(content => {
                        return this._registerSourceMap(new SourceMap(pathToGenerated, pathToGenerated, content));
                    });
                }).catch((error) => {
                    return Promise.reject(XHR.getErrorStatusDescription(error.status) || error.toString());
                });
            });
        }
        throw new Error(`url is not a valid source map`);
    }
    /**
     * Register the given source map in all maps.
     */
    _registerSourceMap(map) {
        if (map) {
            const genPath = PathUtils.pathNormalize(map.generatedPath());
            this._generatedToSourceMaps.set(genPath, map);
            const sourcePaths = map.allSourcePaths();
            for (let path of sourcePaths) {
                const key = PathUtils.pathNormalize(path);
                this._sourceToGeneratedMaps.set(key, map);
                this._log(`_registerSourceMap: ${key} -> ${genPath}`);
            }
        }
        return map;
    }
    _readFile(path, encoding = 'utf8') {
        return new Promise((resolve, reject) => {
            FS.readFile(path, encoding, (err, fileContents) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(PathUtils.stripBOM(fileContents));
                }
            });
        });
    }
    _writeFile(path, data) {
        return new Promise((resolve, reject) => {
            PathUtils.mkdirs(Path.dirname(path));
            FS.writeFile(path, data, err => {
                if (err) {
                    // ignore error
                    // reject(err);
                }
                resolve(data);
            });
        });
    }
    _log(message) {
        this._session.log('sm', message);
    }
}
SourceMaps.SOURCE_MAPPING_MATCHER = new RegExp('^//[#@] ?sourceMappingURL=(.+)$');
exports.SourceMaps = SourceMaps;
class SourceMap {
    constructor(mapPath, generatedPath, json) {
        this._sourcemapLocation = this.fixPath(Path.dirname(mapPath));
        const sm = JSON.parse(json);
        if (!generatedPath) {
            let file = sm.file;
            if (!PathUtils.isAbsolutePath(file)) {
                generatedPath = PathUtils.makePathAbsolute(mapPath, file);
            }
        }
        generatedPath = PathUtils.pathToNative(generatedPath);
        this._generatedFile = generatedPath;
        // fix all paths for use with the source-map npm module.
        sm.sourceRoot = this.fixPath(sm.sourceRoot, '');
        for (let i = 0; i < sm.sources.length; i++) {
            sm.sources[i] = this.fixPath(sm.sources[i]);
        }
        this._sourceRoot = sm.sourceRoot;
        // use source-map utilities to normalize sources entries
        this._sources = sm.sources
            .map(util.normalize)
            .map((source) => {
            return this._sourceRoot && util.isAbsolute(this._sourceRoot) && util.isAbsolute(source)
                ? util.relative(this._sourceRoot, source)
                : source;
        });
        try {
            this._smc = new SM.SourceMapConsumer(sm);
        }
        catch (e) {
            // ignore exception and leave _smc undefined
        }
    }
    /*
     * The generated file this source map belongs to.
     */
    generatedPath() {
        return this._generatedFile;
    }
    allSourcePaths() {
        const paths = new Array();
        for (let name of this._sources) {
            if (!util.isAbsolute(name)) {
                name = util.join(this._sourceRoot, name);
            }
            let path = this.absolutePath(name);
            paths.push(path);
        }
        return paths;
    }
    /*
     * Finds the nearest source location for the given location in the generated file.
     * Returns null if sourcemap is invalid.
     */
    originalPositionFor(line, column, bias) {
        if (!this._smc) {
            return null;
        }
        const needle = {
            line: line,
            column: column,
            bias: bias || Bias.LEAST_UPPER_BOUND
        };
        const mp = this._smc.originalPositionFor(needle);
        if (mp.source) {
            // if source map has inlined source, return it
            const src = this._smc.sourceContentFor(mp.source);
            if (src) {
                mp.content = src;
            }
            // map result back to absolute path
            mp.source = this.absolutePath(mp.source);
            mp.source = PathUtils.pathToNative(mp.source);
        }
        return mp;
    }
    /*
     * Finds the nearest location in the generated file for the given source location.
     * Returns null if sourcemap is invalid.
     */
    generatedPositionFor(absPath, line, column, bias) {
        if (!this._smc) {
            return null;
        }
        // make sure that we use an entry from the "sources" array that matches the passed absolute path
        const source = this.findSource(absPath);
        if (source) {
            const needle = {
                source: source,
                line: line,
                column: column,
                bias: bias || Bias.LEAST_UPPER_BOUND
            };
            return this._smc.generatedPositionFor(needle);
        }
        return null;
    }
    /**
     * fix a path for use with the source-map npm module because:
     * - source map sources are URLs, so even on Windows they should be using forward slashes.
     * - the source-map library expects forward slashes and their relative path logic
     *   (specifically the "normalize" function) gives incorrect results when passing in backslashes.
     * - paths starting with drive letters are not recognized as absolute by the source-map library.
     */
    fixPath(path, dflt) {
        if (path) {
            path = path.replace(/\\/g, '/');
            // if path starts with a drive letter convert path to a file url so that the source-map library can handle it
            if (/^[a-zA-Z]\:\//.test(path)) {
                // Windows drive letter must be prefixed with a slash
                path = encodeURI('file:///' + path);
            }
            return path;
        }
        return dflt;
    }
    /**
     * undo the fix
     */
    unfixPath(path) {
        const prefix = 'file://';
        if (path.indexOf(prefix) === 0) {
            path = path.substr(prefix.length);
            path = decodeURI(path);
            if (/^\/[a-zA-Z]\:\//.test(path)) {
                path = path.substr(1); // remove additional '/'
            }
        }
        return path;
    }
    /**
     * returns the first entry from the sources array that matches the given absPath
     * or null otherwise.
     */
    findSource(absPath) {
        absPath = PathUtils.pathNormalize(absPath);
        for (let name of this._sources) {
            if (!util.isAbsolute(name)) {
                name = util.join(this._sourceRoot, name);
            }
            let path = this.absolutePath(name);
            path = PathUtils.pathNormalize(path);
            if (absPath === path) {
                return name;
            }
        }
        return null;
    }
    /**
     * Tries to make the given path absolute by prefixing it with the source map's location.
     * Any url schemes are removed.
     */
    absolutePath(path) {
        if (!util.isAbsolute(path)) {
            path = util.join(this._sourcemapLocation, path);
        }
        return this.unfixPath(path);
    }
}
exports.SourceMap = SourceMap;

//# sourceMappingURL=../../out/node/sourceMaps.js.map
