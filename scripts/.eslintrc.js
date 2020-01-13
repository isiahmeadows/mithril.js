module.exports = require("./eslint-config.js")("js", {
    env: {
        node: true,
        es6: true,
    },
    rules: {
        "no-esnext/no-esnext": "off",
    }
})
