module.exports = require("../../../scripts/eslint-config.js")("js", {
    parser: "babel-eslint",
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        sourceType: "module",
    },
    env: {browser: true, es6: true},
    plugins: ["babel", "react", "react-hooks"],
    extends: ["plugin:react/recommended"],
    globals: {T: false},
    rules: {
        "react/prop-types": "off",
        "max-len": ["error", 100],
    },
})

const shimmedRules = {}

// I've excluded from this list rules that are no longer needed, like `quotes`
// for JSX fragments.
for (const key of [
    // Rules that aren't used are commented out.
    // "new-cap",
    // "camelcase",
    "no-invalid-this",
    // "object-curly-spacing",
    // "semi",
    // "no-unused-expressions",
    // "valid-typeof",
]) {
    if (key in module.exports) {
        module.exports[`babel/${key}`] = module.exports[key]
        module.exports[key] = "off"
    }
}
