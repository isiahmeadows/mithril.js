module.exports = {
	"plugins": ["no-esnext"],
	"globals": {
		"Promise": false,
	},
	"parserOptions": {
		"sourceType": "module",
		"ecmaVersion": 2018
	},
	"rules": {
		"no-esnext/no-esnext": ["error", {"ecmaVersion": 5}],
	}
};
