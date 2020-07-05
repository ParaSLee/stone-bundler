const fs = require('fs');
const path = require('path');
// 用来解析js代码，把js代码解析成抽象语法树（AST）
const parser = require('@babel/parser');
const traverse = require("@babel/traverse").default;
const babel = require('@babel/core');

const moduleAnalyser = (filename) => {
    const content = fs.readFileSync(filename, 'utf-8');
    // 解析成抽象语法树
    // 抽象语法树能把js-sting转换成一个AST对象，如果不这样做的话需要我们通过字符串匹配的形式获取导入语句(import)
    // 过于复杂。babel也有工具能帮我进行这些处理
    const AST = parser.parse(content, {
        sourceType: 'module'
    })
    // console.log(content);
    // console.log(parserContent.program.body);

    // 获取本次解析对象中文件里引入的依赖
    const dependencies = {};
    // traverse会遍历AST
    traverse(AST, {
        // 找出所有node.type为ImportDeclaration的值
        ImportDeclaration: function(nodePath) {
            // 获取filename的文件路径， ./src/index.js 输出 ./src
            const dirname = path.dirname(filename);
            // console.log(dirname);

            const absolutePath = path.join(dirname, nodePath.node.source.value);

            // dependencies里写入依赖的绝对路径
            dependencies[nodePath.node.source.value] = './' + absolutePath.replace(/\\/g, '/');
            // console.log(nodePath);
            // console.log(nodePath.node);
        }
    });

    // console.log(dependencies);
    
    // 把ast翻译成浏览器可运行的代码
    const result = babel.transformFromAst(AST, null, {
        presets: ["@babel/preset-env"]
    })

    // 返回分析结果
    return {
        filename, // 文件名
        dependencies, // 文件依赖
        code: result.code // 文件代码通过babel处理后的结果
    }
}

const dependenciesGraph = (entry) => {
    const moduleInfo = moduleAnalyser(entry);
    const dependArray = [moduleInfo];
    // 遍历获取所有文件中的依赖（存在重复项，可以优化）
    for (let i = 0; i < dependArray.length; i++) {
        const {dependencies} = dependArray[i];

        if (dependencies) {
            for (let key in dependencies) {
                dependArray.push(moduleAnalyser(dependencies[key]));
            }
        }
    }

    // 从dependArray中提取唯一依赖，并且转换为对象
    const graph = {};
    dependArray.forEach(item => {
        const {filename} = item;
        if (!graph[filename]) {
            graph[filename] = {
                dependencies: item.dependencies,
                code: item.code
            }
        }
    });

    return graph;
}

const generateCode = (entry) => {
    const graph = JSON.stringify(dependenciesGraph(entry));
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
        })(${graph})
    `;
}


const code = generateCode('./src/index.js');

console.log(code);
