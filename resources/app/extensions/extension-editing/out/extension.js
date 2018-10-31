/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var packageDocumentHelper_1 = require("./packageDocumentHelper");
var extensionLinter_1 = require("./extensionLinter");
function activate(context) {
    var registration = vscode.languages.registerDocumentLinkProvider({ language: 'typescript', pattern: '**/vscode.d.ts' }, _linkProvider);
    context.subscriptions.push(registration);
    //package.json suggestions
    context.subscriptions.push(registerPackageDocumentCompletions());
    context.subscriptions.push(new extensionLinter_1.ExtensionLinter());
}
exports.activate = activate;
var _linkProvider = new /** @class */ (function () {
    function class_1() {
        this._linkPattern = /[^!]\[.*?\]\(#(.*?)\)/g;
    }
    class_1.prototype.provideDocumentLinks = function (document, token) {
        return __awaiter(this, void 0, void 0, function () {
            var key, links;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = document.uri.toString() + "@" + document.version;
                        if (!(!this._cachedResult || this._cachedResult.key !== key)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._computeDocumentLinks(document)];
                    case 1:
                        links = _a.sent();
                        this._cachedResult = { key: key, links: links };
                        _a.label = 2;
                    case 2: return [2 /*return*/, this._cachedResult.links];
                }
            });
        });
    };
    class_1.prototype._computeDocumentLinks = function (document) {
        return __awaiter(this, void 0, void 0, function () {
            var results, text, lookUp, match, offset, targetPos, linkEnd, linkStart;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        text = document.getText();
                        return [4 /*yield*/, ast.createNamedNodeLookUp(text)];
                    case 1:
                        lookUp = _a.sent();
                        this._linkPattern.lastIndex = 0;
                        while ((match = this._linkPattern.exec(text))) {
                            offset = lookUp(match[1]);
                            if (offset === -1) {
                                console.warn("Could not find symbol for link " + match[1]);
                                continue;
                            }
                            targetPos = document.positionAt(offset);
                            linkEnd = document.positionAt(this._linkPattern.lastIndex - 1);
                            linkStart = linkEnd.translate({ characterDelta: -(1 + match[1].length) });
                            results.push(new vscode.DocumentLink(new vscode.Range(linkStart, linkEnd), document.uri.with({ fragment: "" + (1 + targetPos.line) })));
                        }
                        return [2 /*return*/, results];
                }
            });
        });
    };
    return class_1;
}());
var ast;
(function (ast) {
    function createNamedNodeLookUp(str) {
        return __awaiter(this, void 0, void 0, function () {
            var ts, sourceFile, identifiers, spans;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('typescript'); })];
                    case 1:
                        ts = _a.sent();
                        sourceFile = ts.createSourceFile('fake.d.ts', str, ts.ScriptTarget.Latest);
                        identifiers = [];
                        spans = [];
                        ts.forEachChild(sourceFile, function visit(node) {
                            var declIdent = node.name;
                            if (declIdent && declIdent.kind === ts.SyntaxKind.Identifier) {
                                identifiers.push(declIdent.text);
                                spans.push(node.pos, node.end);
                            }
                            ts.forEachChild(node, visit);
                        });
                        return [2 /*return*/, function (dottedName) {
                                var start = -1;
                                var end = Number.MAX_VALUE;
                                for (var _i = 0, _a = dottedName.split('.'); _i < _a.length; _i++) {
                                    var name = _a[_i];
                                    var idx = -1;
                                    while ((idx = identifiers.indexOf(name, idx + 1)) >= 0) {
                                        var myStart = spans[2 * idx];
                                        var myEnd = spans[2 * idx + 1];
                                        if (myStart >= start && myEnd <= end) {
                                            start = myStart;
                                            end = myEnd;
                                            break;
                                        }
                                    }
                                    if (idx < 0) {
                                        return -1;
                                    }
                                }
                                return start;
                            }];
                }
            });
        });
    }
    ast.createNamedNodeLookUp = createNamedNodeLookUp;
})(ast || (ast = {}));
function registerPackageDocumentCompletions() {
    return vscode.languages.registerCompletionItemProvider({ language: 'json', pattern: '**/package.json' }, {
        provideCompletionItems: function (document, position, token) {
            return new packageDocumentHelper_1.PackageDocument(document).provideCompletionItems(position, token);
        }
    });
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\extension-editing\out/extension.js.map
