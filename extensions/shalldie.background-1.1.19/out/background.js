"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const vscode = require("vscode");
const vsHelp_1 = require("./vsHelp");
const vscodePath_1 = require("./vscodePath");
const version_1 = require("./version");
const getCss_1 = require("./getCss");
/**
 * 文件类型
 *
 * @enum {number}
 */
var FileType;
(function (FileType) {
    /**
     * 未修改的css文件
     */
    FileType[FileType["empty"] = 0] = "empty";
    /**
     * hack 过的旧版本css文件
     */
    FileType[FileType["isOld"] = 1] = "isOld";
    /**
     * hack 过的新版本的css文件
     */
    FileType[FileType["isNew"] = 2] = "isNew";
})(FileType || (FileType = {}));
/**
 * 插件逻辑类
 *
 * @export
 * @class Background
 */
class Background {
    constructor() {
        //#region private fields 私有字段
        /**
         * 当前用户配置
         *
         * @private
         * @type {*}
         * @memberof Background
         */
        this.config = vscode.workspace.getConfiguration('background');
        //#endregion
    }
    //#endregion
    //#region private methods 私有方法
    /**
     * 获取 css 文件内容
     *
     * @private
     * @returns {string}
     * @memberof Background
     */
    getCssContent() {
        return fs.readFileSync(vscodePath_1.default.cssPath, 'utf-8');
    }
    /**
     * 设置 css 文件内容
     *
     * @private
     * @param {string} content
     * @memberof Background
     */
    saveCssContent(content) {
        fs.writeFileSync(vscodePath_1.default.cssPath, content, 'utf-8');
    }
    /**
     * 初始化
     *
     * @private
     * @memberof Background
     */
    initialize() {
        let firstload = this.checkFirstload(); // 是否初次加载插件
        let fileType = this.getFileType(); // css 文件目前状态
        // 如果是第一次加载插件，或者旧版本
        if (firstload || fileType == FileType.isOld || fileType == FileType.empty) {
            this.install(true);
        }
    }
    /**
     * 检测是否初次加载，并在初次加载的时候提示用户
     *
     * @private
     * @returns {boolean} 是否初次加载
     * @memberof Background
     */
    checkFirstload() {
        const configPath = path.join(__dirname, '../assets/config.json');
        let info = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (info.firstload) {
            // 提示
            vsHelp_1.default.showInfo('Welcome to use background! U can config it in settings.json.');
            // 标识插件已启动过
            info.firstload = false;
            fs.writeFileSync(configPath, JSON.stringify(info, null, '    '), 'utf-8');
            return true;
        }
        return false;
    }
    /**
     * 获取css文件状态
     *
     * @private
     * @returns {FileType}
     * @memberof Background
     */
    getFileType() {
        let cssContent = this.getCssContent();
        // 未 hack 过
        let ifUnInstall = !~cssContent.indexOf(`background.ver`);
        if (ifUnInstall) {
            return FileType.empty;
        }
        // hack 过的旧版本
        let ifVerOld = !~cssContent.indexOf(`/*background.ver.${version_1.default}*/`);
        if (ifVerOld) {
            fs.writeFileSync(path.join(__dirname, '../xxx.css'), cssContent, 'utf-8');
            return FileType.isOld;
        }
        // hack 过的新版本
        return FileType.isNew;
    }
    /**
     * 安装插件，hack css
     *
     * @private
     * @param {boolean} [refresh] 需要更新
     * @returns {void}
     * @memberof Background
     */
    install(refresh) {
        let lastConfig = this.config; // 之前的配置
        let config = vscode.workspace.getConfiguration('background'); // 当前用户配置
        // 1.如果配置文件改变到时候，当前插件配置没有改变，则返回
        if (!refresh && JSON.stringify(lastConfig) == JSON.stringify(config)) {
            // console.log('配置文件未改变.')
            return;
        }
        // 之后操作有两种：1.初次加载  2.配置文件改变 
        // 2.两次配置均为，未启动插件
        if (!lastConfig.enabled && !config.enabled) {
            // console.log('两次配置均为，未启动插件');
            return;
        }
        // 3.保存当前配置
        this.config = config; // 更新配置
        // 4.如果关闭插件
        if (!config.enabled) {
            this.uninstall();
            vsHelp_1.default.showInfoRestart('Background has been uninstalled! Please restart.');
            return;
        }
        // 5.hack 样式
        let arr = []; // 默认图片
        if (!config.useDefault) { // 自定义图片
            arr = config.customImages;
        }
        // 自定义的样式内容
        let content = getCss_1.default(arr, config.style, config.styles, config.useFront).replace(/\s*$/, ''); // 去除末尾空白
        // 添加到原有样式(尝试删除旧样式)中
        let cssContent = this.getCssContent();
        cssContent = this.clearCssContent(cssContent);
        cssContent += content;
        this.saveCssContent(cssContent);
        vsHelp_1.default.showInfoRestart('Background has been changed! Please restart.');
    }
    /**
     * 卸载
     *
     * @private
     * @memberof Background
     */
    uninstall() {
        try {
            let content = this.getCssContent();
            content = this.clearCssContent(content);
            this.saveCssContent(content);
            return true;
        }
        catch (ex) {
            console.log(ex);
            return false;
        }
    }
    /**
     * 清理css中的添加项
     *
     * @private
     * @param {string} content
     * @returns {string}
     * @memberof Background
     */
    clearCssContent(content) {
        content = content.replace(/\/\*css-background-start\*\/[\s\S]*?\/\*css-background-end\*\//g, '');
        content = content.replace(/\s*$/, '');
        return content;
    }
    //#endregion
    //#region public methods
    /**
     * 初始化，并开始监听配置文件改变
     *
     * @returns {vscode.Disposable}
     * @memberof Background
     */
    watch() {
        this.initialize();
        return vscode.workspace.onDidChangeConfiguration(() => this.install());
    }
}
exports.default = new Background();
//# sourceMappingURL=background.js.map