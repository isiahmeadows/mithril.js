"use strict"

const parent = require("../.eslintrc.js")

module.exports = Object.assign({}, parent, {
	"parserOptions": {
        "ecmaVersion": 2018
    }
})
