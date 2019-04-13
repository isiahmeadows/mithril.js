module.exports = {
	"plugins": ["no-esnext"],
	"extends": "eslint:recommended",
	"parserOptions": {
		"sourceType": "module",
		"ecmaVersion": 2018
	},
	"rules": {
		"no-esnext/no-esnext": ["error", {"ecmaVersion": 5}],
	}
};
