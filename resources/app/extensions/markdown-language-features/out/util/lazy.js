"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
class LazyValue {
    constructor(_getValue) {
        this._getValue = _getValue;
        this._hasValue = false;
    }
    get value() {
        if (!this._hasValue) {
            this._hasValue = true;
            this._value = this._getValue();
        }
        return this._value;
    }
    get hasValue() {
        return this._hasValue;
    }
    map(f) {
        return new LazyValue(() => f(this.value));
    }
}
function lazy(getValue) {
    return new LazyValue(getValue);
}
exports.lazy = lazy;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\markdown-language-features\out/util\lazy.js.map
