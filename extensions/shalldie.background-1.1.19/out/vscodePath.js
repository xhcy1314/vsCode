"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
// 基础目录
const base = path.dirname(require.main.filename);
// css文件路径
const cssPath = path.join(base, 'vs', 'workbench', 'workbench.main.css');
// electron 入口文件所在文件夹
const indexDir = path.join(base, 'vs', 'workbench', 'electron-browser', 'bootstrap');
exports.default = {
    /**
     * 基础目录
     */
    base,
    /**
     * css文件路径
     */
    cssPath,
    /**
     * electron 入口文件所在文件夹
     */
    indexDir
};
//# sourceMappingURL=vscodePath.js.map