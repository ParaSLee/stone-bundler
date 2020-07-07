# stone-bundler
🕳️ 像石子一样的打包工具，功能少、场景小，却又是构建知识山峰不可或缺的成员

## ✏️使用
```shell
git clone https://github.com/ParaSLee/stone-bundler.git
cd stone-bundler
npm install
npm run build
```

## 🏆功能
具备最基础的打包功能：

* 打包JS代码
* 支持ESModule
* 支持基础的编译
* 自动生成打包文件
* 每次构建时清空打包文件夹
* 输出打包信息（目前只做了耗时）


### 📑可配置项
```js
{
    entry: {
        [name: 文件名]: [relative: 文件相对路径]
    },
    output: {
        path: [absolute: 绝对路径]
    }
}
```


### ⚠️注意
代码文件如果使用了模块化语法，需要写出完整的后缀（如 `index.js` ），打包工具没有对文件后缀做兼容处理


## 📦目录
.stone-bundler</br>
│</br>
│-- src // 打包用的文件夹</br>
│  │-- index.js   // 入口文件</br>
│  │-- message.js // 依赖文件1</br>
│  │-- word.js    // 依赖文件2</br>
│</br>
│-- **stone.js**        // 打包核心代码，保留了**部分比较重要的注释**</br>
│</br>
│-- stoneNotes.js   // 打包核心代码，保留了**所有注释**</br>
│</br>
│-- **stone.config.js** // 打包配置文件</br>
│</br>
│   // 其他文件</br>
│-- .gitignore</br>
│-- LICENSE</br>
│-- package.json</br>
│-- package-lock.json</br>
└─- README.md</br>

