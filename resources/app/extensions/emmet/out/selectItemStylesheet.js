"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("./util");
function nextItemStylesheet(startOffset, endOffset, editor, rootNode) {
    let currentNode = util_1.getNode(rootNode, endOffset, true);
    if (!currentNode) {
        currentNode = rootNode;
    }
    if (!currentNode) {
        return;
    }
    // Full property is selected, so select full property value next
    if (currentNode.type === 'property' && startOffset.isEqual(currentNode.start) && endOffset.isEqual(currentNode.end)) {
        return getSelectionFromProperty(currentNode, editor.document, startOffset, endOffset, true, 'next');
    }
    // Part or whole of propertyValue is selected, so select the next word in the propertyValue
    if (currentNode.type === 'property' && startOffset.isAfterOrEqual(currentNode.valueToken.start) && endOffset.isBeforeOrEqual(currentNode.valueToken.end)) {
        let singlePropertyValue = getSelectionFromProperty(currentNode, editor.document, startOffset, endOffset, false, 'next');
        if (singlePropertyValue) {
            return singlePropertyValue;
        }
    }
    // Cursor is in the selector or in a property
    if ((currentNode.type === 'rule' && endOffset.isBefore(currentNode.selectorToken.end))
        || (currentNode.type === 'property' && endOffset.isBefore(currentNode.valueToken.end))) {
        return getSelectionFromNode(currentNode, editor.document);
    }
    // Get the first child of current node which is right after the cursor
    let nextNode = currentNode.firstChild;
    while (nextNode && endOffset.isAfterOrEqual(nextNode.end)) {
        nextNode = nextNode.nextSibling;
    }
    // Get next sibling of current node or the parent
    while (!nextNode && currentNode) {
        nextNode = currentNode.nextSibling;
        currentNode = currentNode.parent;
    }
    return getSelectionFromNode(nextNode, editor.document);
}
exports.nextItemStylesheet = nextItemStylesheet;
function prevItemStylesheet(startOffset, endOffset, editor, rootNode) {
    let currentNode = util_1.getNode(rootNode, startOffset);
    if (!currentNode) {
        currentNode = rootNode;
    }
    if (!currentNode) {
        return;
    }
    // Full property value is selected, so select the whole property next
    if (currentNode.type === 'property' && startOffset.isEqual(currentNode.valueToken.start) && endOffset.isEqual(currentNode.valueToken.end)) {
        return getSelectionFromNode(currentNode, editor.document);
    }
    // Part of propertyValue is selected, so select the prev word in the propertyValue
    if (currentNode.type === 'property' && startOffset.isAfterOrEqual(currentNode.valueToken.start) && endOffset.isBeforeOrEqual(currentNode.valueToken.end)) {
        let singlePropertyValue = getSelectionFromProperty(currentNode, editor.document, startOffset, endOffset, false, 'prev');
        if (singlePropertyValue) {
            return singlePropertyValue;
        }
    }
    if (currentNode.type === 'property' || !currentNode.firstChild || (currentNode.type === 'rule' && startOffset.isBeforeOrEqual(currentNode.firstChild.start))) {
        return getSelectionFromNode(currentNode, editor.document);
    }
    // Select the child that appears just before the cursor
    let prevNode = currentNode.firstChild;
    while (prevNode.nextSibling && startOffset.isAfterOrEqual(prevNode.nextSibling.end)) {
        prevNode = prevNode.nextSibling;
    }
    prevNode = util_1.getDeepestNode(prevNode);
    return getSelectionFromProperty(prevNode, editor.document, startOffset, endOffset, false, 'prev');
}
exports.prevItemStylesheet = prevItemStylesheet;
function getSelectionFromNode(node, document) {
    if (!node) {
        return;
    }
    let nodeToSelect = node.type === 'rule' ? node.selectorToken : node;
    return new vscode.Selection(nodeToSelect.start, nodeToSelect.end);
}
function getSelectionFromProperty(node, document, selectionStart, selectionEnd, selectFullValue, direction) {
    if (!node || node.type !== 'property') {
        return;
    }
    const propertyNode = node;
    let propertyValue = propertyNode.valueToken.stream.substring(propertyNode.valueToken.start, propertyNode.valueToken.end);
    selectFullValue = selectFullValue || (direction === 'prev' && selectionStart.isEqual(propertyNode.valueToken.start) && selectionEnd.isBefore(propertyNode.valueToken.end));
    if (selectFullValue) {
        return new vscode.Selection(propertyNode.valueToken.start, propertyNode.valueToken.end);
    }
    let pos = -1;
    if (direction === 'prev') {
        if (selectionStart.isEqual(propertyNode.valueToken.start)) {
            return;
        }
        pos = selectionStart.isAfter(propertyNode.valueToken.end) ? propertyValue.length : selectionStart.character - propertyNode.valueToken.start.character;
    }
    if (direction === 'next') {
        if (selectionEnd.isEqual(propertyNode.valueToken.end) && (selectionStart.isAfter(propertyNode.valueToken.start) || propertyValue.indexOf(' ') === -1)) {
            return;
        }
        pos = selectionEnd.isEqual(propertyNode.valueToken.end) ? -1 : selectionEnd.character - propertyNode.valueToken.start.character - 1;
    }
    let [newSelectionStartOffset, newSelectionEndOffset] = direction === 'prev' ? util_1.findPrevWord(propertyValue, pos) : util_1.findNextWord(propertyValue, pos);
    if (!newSelectionStartOffset && !newSelectionEndOffset) {
        return;
    }
    const newSelectionStart = propertyNode.valueToken.start.translate(0, newSelectionStartOffset);
    const newSelectionEnd = propertyNode.valueToken.start.translate(0, newSelectionEndOffset);
    return new vscode.Selection(newSelectionStart, newSelectionEnd);
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/1dfc5e557209371715f655691b1235b6b26a06be/extensions\emmet\out/selectItemStylesheet.js.map
