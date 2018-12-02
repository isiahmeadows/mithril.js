"use strict"

var parent = require("../.eslintrc.js")
var config = Object.assign({}, parent, {
	"globals": {
		"o": false,
		"modules": false,
		"utils": false,
	},
	"rules": Object.assign({}, parent.rules, {
		"strict": ["error", "function"],
	})
})
delete config.env

module.exports = config
