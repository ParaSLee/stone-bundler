const fs = require('fs');
const os = require('os');
const path = require('path');
const chalk = require('chalk');
// 用来解析js代码，把js代码解析成抽象语法树（AST）
const parser = require('@babel/parser');
// 用来遍历AST树，找到需要的结点
const traverse = require("@babel/traverse").default;
// 对代码进行编译
const babel = require('@babel/core');

const stoneConfig = require('./stone.config.js');
// 是否是windows
const iswin = os.platform() === 'win32';
// 是否是mac
const isMac = os.platform() === 'darwin';

/**
 * @function 模块分析
 * @param {string} filePath
 * @description 找出一个模块引入了哪些依赖，并获取编译后的代码
 * @returns {
 *  filePath 相对根路径的路径 ex. ./src/index.js
 *  dependencies 引入的依赖  ex. {'./message.js': './src/message.js'}
 *  code 编译后的代码
 * }
 */
const moduleAnalyser = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 1.找出依赖
    // 可以通过字符串匹配的形式获取导入语句(import)，但这个实现过于复杂
    // 通过babel提供的工具，将js-code解析成AST，能更便捷地获取导入语句(import)
    const AST = parser.parse(content, {
        sourceType: 'module' // 如果代码里使用ESModlue需要添加该配置
    });

    // 存储filePath的路径， ./src/index.js 输出 ./src
    const dirname = path.dirname(filePath);
    // 存储模块里引入的依赖
    const dependencies = {};

    // 用traverse遍历AST
    traverse(AST, {
        // 找出所有node.type为ImportDeclaration的值
        ImportDeclaration: function(nodePath) {
            const relativePath = nodePath.node.source.value;
            const absolutePath = path.join(dirname, relativePath);
            // replace是为了解决windows系统下的路径问题
            dependencies[relativePath] = './' + absolutePath.replace(/\\/g, '/');
        }
    });

    // 2.把ast翻译成浏览器可运行的代码
    const {code} = babel.transformFromAst(AST, null, {
        presets: ["@babel/preset-env"]
    })

    return {
        filePath,
        dependencies,
        code
    }
}

/**
 * @function 生成模块图谱
 * @param {string} entry 入口文件路径
 * @description 整理出所有的模块，并构建模块图
 * @returns grap {
 *  '模块路径': {
 *      dependencies: 依赖
 *      code: 代码
 *  }
 * }
 * ex. grap = {
 *  './src/index.js': {
 *      dependencies: {'./message.js': './src/message.js'},
 *      code
 *  }
 * }
 */
const moduleGraph = (entry) => {
    const moduleMuster = [moduleAnalyser(entry)];
    // 缓存已经添加到 moduleMuster 里的内容, 避免 moduleMuster 出现重复值
    const cache = {
        [moduleMuster[0].filePath]: 1
    };
    const graph = {};

    // 递归遍历所有的模块
    for (let i = 0; i < moduleMuster.length; i++) {
        const {filePath} = moduleMuster[i];

        // 已生成了图谱的模块就不需要再解析了
        if (!graph[filePath]) {
            const {dependencies, code} = moduleMuster[i];
            graph[filePath] = {
                dependencies,
                code
            };

            // 遍历模块里的依赖，分析依赖文件，放入模块集合中，之后的循环里再进行解析
            for (let key in dependencies) {
                if (!cache[dependencies[key]]) {
                    moduleMuster.push(moduleAnalyser(dependencies[key]));
                    cache[dependencies[key]] = 1;
                }
            }
        }
    }

    return graph;
}

/**
 * @function 生成代码
 * @param {string} entry 入口文件路径
 * @description 通过传入入口文件路径，生成完整可运行的代码
 * @returns 可执行代码
 */
const generateCode = (entry) => {
    const graph = JSON.stringify(moduleGraph(entry));

    return `
        (function(graph) {
            // 创建require函数
            function require(module) {

                // 代码中的require是引入的相对模块的路径  ex. var _word = require('./word.js')
                // 引入依赖时需要转换成相对根路径的路径  ex. require('./src/word.js')
                // 将requireInEval传递到闭包中供转换使用
                function requireInEval(relativePath) {
                    return require(graph[module].dependencies[relativePath]);
                }

                // 子模块的内容存放在exports中，需要创建空对象以便使用。
                var exports = {};

                // 使用闭包避免模块之间的变量污染
                (function(code, require, exports) {
                    // 通过eval执行代码
                    eval(code);
                })(graph[module].code, requireInEval, exports)

                // 将模块所依赖的内容返回给模块
                return exports;
            }

            // 入口模块需主动引入
            require('${entry}');

        })(${graph})`;
}

/**
 * @function 执行打包
 */
function bundleCode() {
    const startTime = new Date();
    const option = stoneConfig;
    const fileName = Object.keys(option.entry)[0];
    const outPath = option.output.path;

    const code = generateCode(option.entry[fileName]);

    // 读取输出文件夹
    fs.readdir(outPath, function(err, files) {
        // 如果没有文件夹就创建
        let hasDir = true;
        if (err) {
            if (
                (iswin && err.errno === -4058) // windows电脑错误码为4058
                || (isMac && err.errno === -2) // mac电脑错误码为-2
            ) {
                fs.mkdir(outPath, {recursive: true}, err => {
                    if (err) {
                        throw err;
                    }
                });
                hasDir = false;
            } else {
                throw err;
            }
        }

        // 清空输出文件夹里的文件（没做递归删除，在这个项目里无意义）
        if (hasDir) {
            files = fs.readdirSync(outPath);
            files.forEach((file) => {
                let curPath = outPath + (iswin ? '\\' :"/") + file;
                fs.unlinkSync(curPath);
            });
        }

        // 创建打包文件
        fs.writeFile(`${outPath}/${fileName}.js`, code, 'utf8', function(error){
            if (error) {
                throw error;
            }

            console.log();
            console.log(chalk.green('打包完成！'));
            console.log(chalk.green(`耗时: ${chalk.blue(`${new Date() - startTime}ms`)}`));
            console.log();
        })
    })
}

bundleCode();
