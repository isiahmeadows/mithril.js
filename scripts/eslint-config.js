"use strict"

const path = require("path")

const root = path.dirname(__dirname)

const requiresTSReplacement = new Set([
    "brace-style",
    "comma-spacing",
    "default-param-last",
    "func-call-spacing",
    "indent",
    "no-array-constructor",
    "no-dupe-class-members",
    "no-empty-function",
    "no-extra-parens",
    "no-extra-semi",
    "no-magic-numbers",
    "no-unused-expressions",
    "no-unused-vars",
    "no-use-before-define",
    "no-useless-constructor",
    "quotes",
    "require-await",
    "return-await",
    "semi",
    "space-before-function-paren",
])

function pushArrayOrItem(target, source) {
    if (Array.isArray(source)) {
        target.push(...source)
    } else if (source != null) {
        target.push(source)
    }
}

module.exports = (type, extra = {}) => {
    const config = {
        root: true,
        ...extra,
    }

    if (type === "js") {
        config.plugins = ["no-esnext"]
        config.parserOptions = {
            ecmaVersion: 2018,
            ...extra.parserOptions
        }
    } else {
        config.plugins = ["@typescript-eslint"]
        // This parser *must* be set.
        config.parser = "@typescript-eslint/parser"
        config.parserOptions = {
            ...extra.parserOptions,
            // These options *must* be set.
            tsconfigRootDir: root,
            project: ["./tsconfig.json"]
        }
        if (extra.parserOptions) {
            pushArrayOrItem(
                config.parserOptions.project,
                extra.parserOptions.project
            )
        }
    }

    config.extends = ["eslint:recommended"]

    if (type === "ts") {
        config.extends.push(
            "plugin:@typescript-eslint/eslint-recommended",
            "plugin:@typescript-eslint/recommended",
            "plugin:@typescript-eslint/recommended-requiring-type-checking"
        )
    }

    pushArrayOrItem(config.extends, extra.extends)

    config.rules = {
        "accessor-pairs": "error",
        "array-bracket-spacing": [
            "error",
            "never"
        ],
        "array-callback-return": "error",
        "arrow-body-style": "error",
        "arrow-parens": "error",
        "arrow-spacing": "error",
        "block-scoped-var": "off",
        "block-spacing": "off",
        "brace-style": "off",
        "callback-return": "off",
        "camelcase": [
            "error",
            {
                "properties": "never"
            }
        ],
        "comma-dangle": [
            "error",
            "only-multiline"
        ],
        "comma-spacing": "off",
        "comma-style": [
            "error",
            "last"
        ],
        "complexity": "off",
        "computed-property-spacing": [
            "error",
            "never"
        ],
        "consistent-return": "off",
        "consistent-this": "off",
        "curly": "off",
        "default-case": "off",
        "dot-location": [
            "error",
            "property"
        ],
        "dot-notation": "off",
        "eol-last": "off",
        "eqeqeq": "off",
        "func-names": "off",
        "func-style": "off",
        "generator-star-spacing": "error",
        "global-require": "error",
        "guard-for-in": "off",
        "handle-callback-err": "error",
        "id-blacklist": "error",
        "id-length": "off",
        "id-match": "error",
        "indent": ["error", 4, {outerIIFEBody: 0}],
        "init-declarations": "off",
        "jsx-quotes": "error",
        "key-spacing": "off",
        "keyword-spacing": "off",
        "linebreak-style": "off",
        "lines-around-comment": "off",
        "max-depth": "off",
        "max-len": ["error", {
            code: 80,
            // Disable the things we can't break up
            ignoreUrls: true,
            ignoreRegExpLiterals: true,
            // One line to disable is bad enough. Let's not also have to disable
            // `max-len` just to silence a warning when we're sufficiently
            // nested (typescript-eslint's names can get rather long).
            ignorePattern: "(?:" + [
                "//\\s*eslint-disable-next-line\\s+",
                "/\\*\\s*eslint-disable\\s+[^\r\n*]*?\\*/"
            ].join("|") + ")",
        }],
        "max-nested-callbacks": "error",
        "max-params": "off",
        "max-statements": "off",
        "max-statements-per-line": "off",
        "new-parens": "off",
        "newline-after-var": "off",
        "newline-before-return": "off",
        "newline-per-chained-call": "off",
        "no-alert": "error",
        "no-array-constructor": "error",
        "no-bitwise": "error",
        "no-caller": "error",
        "no-catch-shadow": "off",
        "no-cond-assign": "off",
        // This rule is so frequently violated it's easier to just disable it
        // for now.
        // "no-confusing-arrow": "error",
        "no-console": "off",
        "no-continue": "off",
        "no-div-regex": "error",
        "no-duplicate-imports": "error",
        "no-else-return": "off",
        "no-empty-function": "off",
        "no-eq-null": "off",
        "no-eval": "error",
        "no-extend-native": "off",
        "no-extra-bind": "error",
        "no-extra-label": "error",
        "no-extra-parens": "off",
        "no-floating-decimal": "error",
        // I'd rather the engine be able to detect coercions statically.
        // "no-implicit-coercion": "error",
        "no-implicit-globals": "error",
        "no-implied-eval": "error",
        "no-inline-comments": "off",
        "no-invalid-this": "off",
        "no-iterator": "error",
        "no-label-var": "off",
        "no-labels": "off",
        "no-lone-blocks": "error",
        "no-lonely-if": "off",
        "no-loop-func": "off",
        "no-magic-numbers": "off",
        "no-mixed-requires": "error",
        "no-multi-spaces": "error",
        "no-multi-str": "error",
        "no-multiple-empty-lines": "error",
        "no-native-reassign": "error",
        "no-negated-condition": "off",
        "no-nested-ternary": "off",
        "no-new": "off",
        "no-new-func": "off",
        "no-new-object": "error",
        "no-new-require": "error",
        "no-new-wrappers": "error",
        "no-octal-escape": "error",
        "no-param-reassign": "off",
        "no-path-concat": "off",
        "no-plusplus": "off",
        "no-process-env": "error",
        "no-process-exit": "error",
        "no-proto": "error",
        "no-redeclare": "off",
        "no-restricted-globals": "error",
        "no-restricted-imports": "error",
        "no-restricted-modules": "error",
        "no-restricted-syntax": "error",
        "no-return-assign": "off",
        "no-script-url": "error",
        "no-self-compare": "error",
        "no-sequences": "off",
        "no-shadow": "off",
        "no-shadow-restricted-names": "error",
        "no-spaced-func": "error",
        "no-sync": "off",
        "no-ternary": "off",
        "no-throw-literal": "off",
        "no-trailing-spaces": [
            "error",
            {
                "skipBlankLines": true
            }
        ],
        "no-undef-init": "error",
        "no-undefined": "off",
        "no-underscore-dangle": "off",
        "no-unmodified-loop-condition": "error",
        "no-unneeded-ternary": "error",
        "no-unused-expressions": "off",
        "no-use-before-define": "off",
        "no-useless-call": "error",
        "no-useless-concat": "error",
        "no-useless-constructor": "error",
        "no-useless-escape": "off",
        "no-var": "off",
        "no-void": "off",
        "no-warning-comments": "off",
        "no-whitespace-before-property": "error",
        "no-with": "error",
        "object-curly-spacing": [
            "error",
            "never"
        ],
        "object-shorthand": "off",
        "one-var": "off",
        "one-var-declaration-per-line": "off",
        "operator-assignment": [
            "error",
            "always"
        ],
        "operator-linebreak": "off",
        "padded-blocks": "off",
        "prefer-arrow-callback": "off",
        "prefer-const": "error",
        "prefer-reflect": "off",
        "prefer-rest-params": "off",
        "prefer-spread": "off",
        "prefer-template": "off",
        "quote-props": "off",
        "quotes": [
            "error",
            "double",
            {"avoidEscape": true}
        ],
        "radix": [
            "error",
            "always"
        ],
        "require-jsdoc": "off",
        "require-yield": "error",
        "semi": ["error", "never", {
            beforeStatementContinuationChars: "always"
        }],
        "semi-spacing": "error",
        // This is so frequently violated, it's easier to just disable it for
        // now.
        // "sort-imports": "error",
        "sort-vars": "off",
        "space-before-blocks": "off",
        "space-before-function-paren": "off",
        "space-in-parens": [
            "error",
            "never"
        ],
        "space-infix-ops": "off",
        "space-unary-ops": "error",
        "spaced-comment": "off",
        "strict": ["error", "global"],
        "template-curly-spacing": "error",
        "valid-jsdoc": "off",
        "vars-on-top": "off",
        "wrap-iife": "off",
        "wrap-regex": "error",
        "yield-star-spacing": "error",
        "yoda": "off",
    }

    if (type === "ts") {
        for (const [key, value] of Object.entries(config.rules)) {
            if (requiresTSReplacement.has(key)) {
                config.rules[key] = "off"
                if (!config.rules[`@typescript-eslint/${key}`]) {
                    config.rules[`@typescript-eslint/${key}`] = value
                }
            }
        }

        Object.assign(config.rules, {
            // Important for type checking
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unsafe-call": "error",
            "@typescript-eslint/no-unsafe-member-access": "error",
            "@typescript-eslint/no-unsafe-return": "error",
            "@typescript-eslint/restrict-plus-operands": "error",

            // I do a *lot* of defensive coding, and it's better to have a
            // condition checked than not have a condition checked.
            "@typescript-eslint/no-unnecessary-condition": "off",

            // There's literally nothing to gain from this.
            "@typescript-eslint/no-empty-function": "off",

            // Just too much boilerplate
            "@typescript-eslint/explicit-function-return-type": "off",
            // Our target isn't high enough for these to be reliably present,
            // and I'd rather not use these if they aren't (as they don't offer
            // much speed-up).
            "@typescript-eslint/prefer-includes": "off",
            "@typescript-eslint/prefer-string-starts-ends-with": "off",
            // I have TS configured to where this isn't a problem
            "@typescript-eslint/unbound-method": "off",
            // The code base is all ASI, and I'd like to keep that consistent
            "@typescript-eslint/member-delimiter-style": ["error", {
                multiline: {delimiter: "none"},
                singleline: {requireLast: false},
                overrides: {
                    interface: {singleline: {delimiter: "semi"}},
                    typeLiteral: {singleline: {delimiter: "comma"}},
                },
            }],

            // And of course, a few vanity rules
            "@typescript-eslint/ban-types": "error",
            "@typescript-eslint/consistent-type-assertions": "error",
            "@typescript-eslint/no-extra-non-null-assertion": "error",
            "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
            "@typescript-eslint/no-unnecessary-type-assertion": "error",
            "@typescript-eslint/prefer-as-const": "off",
        })

        // https://github.com/typescript-eslint/typescript-eslint/issues/455
        // https://github.com/typescript-eslint/typescript-eslint/issues/1824
        //
        // Note: if any more node types need ignored, see here:
        // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/typescript-estree/src/ts-estree/ast-node-types.ts
        config.rules["@typescript-eslint/indent"][2].ignoredNodes = [
            "TSTypeParameterInstantiation",
        ]
    }

    Object.assign(config.rules, extra.rules)

    return config
}
