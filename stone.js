const fs = require('fs');
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const parser = require('@babel/parser');
const traverse = require("@babel/traverse").default;
const babel = require('@babel/core');

const stoneConfig = require('./stone.config.js');

const iswin = os.platform() === 'win32';
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
    const AST = parser.parse(content, {
        sourceType: 'module'
    });

    const dirname = path.dirname(filePath);
    const dependencies = {};

    traverse(AST, {
        ImportDeclaration: function(nodePath) {
            const relativePath = nodePath.node.source.value;
            const absolutePath = path.join(dirname, relativePath);
            // replace是为了解决windows系统下的路径问题
            dependencies[relativePath] = './' + absolutePath.replace(/\\/g, '/');
        }
    });

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
    const cache = {
        [moduleMuster[0].filePath]: 1
    };
    const graph = {};

    for (let i = 0; i < moduleMuster.length; i++) {
        const {filePath} = moduleMuster[i];

        if (!graph[filePath]) {
            const {dependencies, code} = moduleMuster[i];
            graph[filePath] = {
                dependencies,
                code
            };

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
            function require(module) {

                function requireInEval(relativePath) {
                    return require(graph[module].dependencies[relativePath]);
                }

                var exports = {};

                (function(code, require, exports) {
                    eval(code);
                })(graph[module].code, requireInEval, exports)

                return exports;
            }

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

    fs.readdir(outPath, function(err, files) {
        // 没文件夹就创建文件夹
        let hasDir = true;
        if (err) {
            if (
                (iswin && err.errno === -4058)
                || (isMac && err.errno === -2)
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

        // 清空文件
        if (hasDir) {
            files = fs.readdirSync(outPath);
            files.forEach((file) => {
                let curPath = outPath + (iswin ? '\\' :"/") + file;
                fs.unlinkSync(curPath);
            });
        }

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
