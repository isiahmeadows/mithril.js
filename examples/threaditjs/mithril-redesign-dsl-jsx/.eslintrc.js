module.exports = {
    "parserOptions": {
        "ecmaFeatures": {
            "jsx": true,
        },
        "sourceType": "module"
    },
    "env": {
        "browser": true
    },
    "rules": {
        // Until I can get a plugin that auto-uses `m` from Mithril.
        "no-unused-vars": "off",
        "max-len": ["error", 100]
    }
};
