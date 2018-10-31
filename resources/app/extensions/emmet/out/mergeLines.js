"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("./util");
function mergeLines() {
    if (!util_1.validate(false) || !vscode.window.activeTextEditor) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    let rootNode = util_1.parseDocument(editor.document);
    if (!rootNode) {
        return;
    }
    return editor.edit(editBuilder => {
        editor.selections.reverse().forEach(selection => {
            let textEdit = getRangesToReplace(editor.document, selection, rootNode);
            if (textEdit) {
                editBuilder.replace(textEdit.range, textEdit.newText);
            }
        });
    });
}
exports.mergeLines = mergeLines;
function getRangesToReplace(document, selection, rootNode) {
    let startNodeToUpdate;
    let endNodeToUpdate;
    if (selection.isEmpty) {
        startNodeToUpdate = endNodeToUpdate = util_1.getNode(rootNode, selection.start);
    }
    else {
        startNodeToUpdate = util_1.getNode(rootNode, selection.start, true);
        endNodeToUpdate = util_1.getNode(rootNode, selection.end, true);
    }
    if (!startNodeToUpdate || !endNodeToUpdate || startNodeToUpdate.start.line === endNodeToUpdate.end.line) {
        return;
    }
    let rangeToReplace = new vscode.Range(startNodeToUpdate.start, endNodeToUpdate.end);
    let textToReplaceWith = document.lineAt(startNodeToUpdate.start.line).text.substr(startNodeToUpdate.start.character);
    for (let i = startNodeToUpdate.start.line + 1; i <= endNodeToUpdate.end.line; i++) {
        textToReplaceWith += document.lineAt(i).text.trim();
    }
    return new vscode.TextEdit(rangeToReplace, textToReplaceWith);
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\emmet\out/mergeLines.js.map
