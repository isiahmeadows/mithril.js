const globalRules = require("../../../.eslintrc.js")
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
	if (key in globalRules) {
		shimmedRules[`babel/${key}`] = globalRules[key]
	}
}

module.exports = {
	"parser": "babel-eslint",
	"parserOptions": {
		"ecmaFeatures": {
			"jsx": true,
		},
	},
	"extends": ["plugin:react/recommended"],
	"rules": {
		"react/prop-types": "off",
		...shimmedRules,
	},
};
