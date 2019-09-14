module.exports = {
    "parserOptions": {
        "ecmaFeatures": {
            "jsx": true,
        },
    },
    "extends": ["plugin:react/recommended"],
    "rules": {
        "react/prop-types": "off",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
    },
};
