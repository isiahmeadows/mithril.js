/* eslint-env node, shelljs */
"use strict"

// If you're confused what the heck `shelljs/make` is, see here:
// https://github.com/shelljs/shelljs/blob/master/make.js
//
// It's a simple build tool that's more powerful than npm, but retains a similar
// level of simplicity. It also makes it easier to keep tasks OS-independent.

const path = require("path")
require("shelljs/make")
const p = (...args) => path.resolve(__dirname, ...args)

// So binaries get detected correctly.
env.PATH = p("node_modules/.bin") + path.delimiter + env.PATH

function nonfatalExec(...args) {
	var prev = config.fatal
	config.fatal = false
	exec(...args)
	config.fatal = prev
}

target["lint"] = function () {
	nonfatalExec("eslint . --cache", {cwd: p(".")})
}

target["lint:fix"] = function () {
	nonfatalExec("eslint . --cache --fix", {cwd: p(".")})
}

target["test"] = function () {
	target["test:mithril"]()
}

target["test:mithril"] = function () {
	exec(
		`${p("node_modules/.bin/_mocha")}\
		  --require esm --require scripts/test-setup.js\
			--color test/`,
		{cwd: p("packages/mithril")}
	)
}
