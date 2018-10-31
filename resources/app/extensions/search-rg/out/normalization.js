"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The normalize() method returns the Unicode Normalization Form of a given string. The form will be
 * the Normalization Form Canonical Composition.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize}
 */
exports.canNormalize = typeof (''.normalize) === 'function';
function normalizeNFC(str) {
    return normalize(str, 'NFC');
}
exports.normalizeNFC = normalizeNFC;
function normalizeNFD(str) {
    return normalize(str, 'NFD');
}
exports.normalizeNFD = normalizeNFD;
var nonAsciiCharactersPattern = /[^\u0000-\u0080]/;
function normalize(str, form) {
    if (!exports.canNormalize || !str) {
        return str;
    }
    var res;
    if (nonAsciiCharactersPattern.test(str)) {
        res = str.normalize(form);
    }
    else {
        res = str;
    }
    return res;
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\search-rg\out/normalization.js.map
