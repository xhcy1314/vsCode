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
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
class InputBoxImpl {
    constructor(inputBox) {
        this.inputBox = inputBox;
    }
    set value(value) { this.inputBox.value = value; }
    get value() { return this.inputBox.value; }
}
exports.InputBoxImpl = InputBoxImpl;
class RepositoryImpl {
    constructor(repository) {
        this.rootUri = vscode_1.Uri.file(repository.root);
        this.inputBox = new InputBoxImpl(repository.inputBox);
    }
}
exports.RepositoryImpl = RepositoryImpl;
class APIImpl {
    constructor(modelPromise) {
        this.modelPromise = modelPromise;
    }
    getGitPath() {
        return __awaiter(this, void 0, void 0, function* () {
            const model = yield this.modelPromise;
            return model.git.path;
        });
    }
    getRepositories() {
        return __awaiter(this, void 0, void 0, function* () {
            const model = yield this.modelPromise;
            return model.repositories.map(repository => new RepositoryImpl(repository));
        });
    }
}
exports.APIImpl = APIImpl;
function createApi(modelPromise) {
    return new APIImpl(modelPromise);
}
exports.createApi = createApi;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\git\out/api.js.map
