module.exports = require("../../scripts/eslint-config.js")("js", {
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
    },
    globals: {T: false},
    rules: {
        "react/prop-types": "off",
    },
})
