module.exports = {
	"extends": ["plugin:react/recommended"],
	"parserOptions": {
		"ecmaFeatures": {
			"jsx": true,
		},
	},
	"rules": {
		"react/prop-types": "off",
		"react-hooks/rules-of-hooks": "error",
		"react-hooks/exhaustive-deps": "warn",
	},
};
