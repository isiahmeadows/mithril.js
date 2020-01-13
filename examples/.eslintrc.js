module.exports = require("../scripts/eslint-config.js")("js", {
    env: {
        browser: true,
        commonjs: true,
        es6: true,
        node: true
    },
    plugins: ["babel", "react", "react-hooks"],
    parserOptions: {
        sourceType: "module",
    },
})
