"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models = require("../models/i18n");
const langResourceCollection_1 = require("./langResourceCollection");
const constants_1 = require("../constants");
class LanguageResourceManager {
    constructor(language, resourceCollection) {
        this.language = language;
        this.resourceCollection = resourceCollection;
        this.resourceCollection = this.resourceCollection || langResourceCollection_1.langResourceCollection;
        this.messages =
            (this.language && this.resourceCollection[this.language.toLowerCase()]) ||
                this.resourceCollection['en'];
    }
    getMessage(...keys) {
        if (!this.messages) {
            return '';
        }
        let msg = '';
        keys.forEach(key => {
            // If key is of type 'number' it's a LangResourceKeys
            const stringifiedKey = typeof key === 'number' ? models.LangResourceKeys[key] : key;
            if (typeof key === 'number') {
                if (Reflect.has(this.messages, stringifiedKey)) {
                    // If no message is found fallback to english message
                    let message = this.messages[stringifiedKey] ||
                        langResourceCollection_1.langResourceCollection['en'][stringifiedKey];
                    // If not a string then it's of type IOSSpecific
                    if (typeof message !== 'string') {
                        if (Reflect.has(message, process.platform)) {
                            message = message[process.platform];
                        }
                        else {
                            throw new Error(`Not Implemented: ${process.platform}`);
                        }
                    }
                    msg += message;
                    return;
                }
                throw new Error(`${stringifiedKey} is not valid`);
            }
            stringifiedKey.split('').forEach(char => {
                if (char.match(/[#^*|\\/{}+=]/g)) {
                    throw new Error(`${char} is not valid`);
                }
                msg += char;
                return;
            });
        });
        return msg.replace(/%extensionName%/gi, constants_1.constants.extensionName).trim();
    }
}
exports.LanguageResourceManager = LanguageResourceManager;
//# sourceMappingURL=languageResourceManager.js.map