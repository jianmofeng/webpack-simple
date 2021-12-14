// 导入包
const fs = require('fs')
const path = require('path')
// 解析代码为ast
const parser = require('@babel/parser')
// 对ast遍历的工具，维护了整棵树的状态，并且负责替换、移除和添加节点
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

// 转换代码，生成依赖
function stepOne(filename) {
    // 读入文件
    const content = fs.readFileSync(filename, 'utf-8')
    
    const ast = parser.parse(content, {
        sourceType:'module', //babel官方规定必须加这个参数，不然无法识别ES Module
    })
    // console.log(`(╯‵□′)╯︵┻━┻`, content)
    const dependencies = {}
    // 遍历AST抽象语法树
    traverse(ast, {
        // 获取通过import引入的模块
        ImportDeclaration({ node }) {
            const dirname = path.dirname(filename)
            const newFile = `./${path.join(dirname, node.source.value)}`
            // 保存所依赖的模块
            dependencies[node.source.value] = newFile
        }
    })
    // 通过@babel/core和@babel/preset-env进行代码的转换
    // babel.transformFromAst 给定一个ast，转换为代码
    // @babel/preset-env, ES6 -> ES5
    const { code } = babel.transformFromAst(ast, null, {
        presets: ['@babel/preset-env']
    })
    
    return {
        filename, //该文件名
        dependencies, //该文件所依赖的模块集合（键值对存储）
        code, //转换后的代码
    }
}
// stepOne('../src/index.js')
// 生成依赖图谱
function setpTwo(entry) {
    const entryModule = stepOne(entry)
    const graphArray = [entryModule]
    for (let i = 0; i < graphArray.length; i++){
        const item = graphArray[i]
        const { dependencies } = item
        for (let j in dependencies) {
            graphArray.push(
                stepOne(dependencies[j])
            )
        }
    }
    const graph = {}
    graphArray.forEach(item => {
        graph[item.filename] = {
            dependencies: item.dependencies,
            code: item.code
        }
    })
    return graph
}
// console.log(`(╯‵□′)╯︵┻━┻`, setpTwo('../src/index.js'))
// 生成代码字符串
function step3(entry) {
    const graph = JSON.stringify(setpTwo(entry))
    return `
        (function(graph){
            // require函数本质上是执行一个模块的代码，然后再将对应的变量挂在到exports对象上
            function require(module){
                function localRequire(relativePath){
                    return require(graph[module].dependencies[relativePath])
                }
                var exports = {};
                (function(require, exports, code){
                    eval(code);
                })(localRequire, exports, graph[module].code);
                return exports;
            }
            require('${entry}')
        })(${graph})
    `
}
const code = step3('../src/index.js')
console.log(code)

`下面是结果
(function(graph){
    // require函数本质上是执行一个模块的代码，然后再将对应的变量挂在到exports对象上
    function require(module){
        function localRequire(relativePath){
            return require(graph[module].dependencies[relativePath])
        }
        var exports = {};
        (function(require, exports, code){
            eval(code);
        })(localRequire, exports, graph[module].code);
        return exports;
    }
    require('../src/index.js')
})({"../src/index.js":{"dependencies":{"./message/B.js":"./../src/message/B.js"},"code":"\"use strict\";\n\nvar _B = _interopRequireDefault(require(\"./message/B.js\"));\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { \"default\": obj }; }\n\nconsole.log(\"(\\u256F\\u2035\\u25A1\\u2032)\\u256F\\uFE35\\u253B\\u2501\\u253B\", _B[\"default\"]);"},"./../src/message/B.js":{"dependencies":{"./A.js":"./../src/message/A.js"},"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports[\"default\"] = void 0;\n\nvar _A = require(\"./A.js\");\n\nvar message = \"say \".concat(_A.word);\nvar _default = message;\nexports[\"default\"] = _default;"},"./../src/message/A.js":{"dependencies":{},"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports.word = void 0;\nvar word = 'hello';\nexports.word = word;"}})`