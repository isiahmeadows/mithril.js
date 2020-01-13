module.exports = require("../../scripts/eslint-config.js")("js", {
    env: {
        browser: true,
        commonjs: true,
        es6: true,
        node: true
    },
    parserOptions: {
        sourceType: "module",
    }
})
