"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ErrorHandler {
    static logError(error, handled = false) {
        console.error(`${handled ? 'H' : 'Unh'}andled Error: ${error.stack ||
            error.message ||
            error}`);
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=errorHandler.js.map