module.exports = require("../../../scripts/eslint-config.js")("js", {
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        sourceType: "module",
    },
    env: {browser: true, es6: true},
    plugins: ["react", "react-hooks"],
    extends: ["plugin:react/recommended"],
    globals: {T: false},
    rules: {
        "react/prop-types": "off",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        "max-len": ["error", 100],
    },
})
