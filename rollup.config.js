"use strict"

var path = require("path")
var commonjs = require("rollup-plugin-commonjs")
var json = require("rollup-plugin-json")
var nodeResolve = require("rollup-plugin-node-resolve")

module.exports = function (args) {
	var globalOpts = {
		watch: {
			chokidar: true,
			exclude: "node_modules/**",
		},
		plugins: [
			// We normally use `window` and `global` directly, and `global`
			// replacement will interfere with our existing global detection.
			// Also, treat `util` as external so `rollup-plugin-node-resolve`
			// doesn't try to transpile it and then complain of it "missing".
			commonjs({
				ignoreGlobal: true,
				ignore: ["util", "./ospec/ospec"],
			}),
			json({compact: true}),
			nodeResolve(),
		],
	}

	function build(input, output) {
		return Object.assign({}, globalOpts, {
			input: path.resolve(__dirname, input),
			output: {
				file: path.resolve(__dirname, output),
				format: "iife",
				// Our bundles manually install themselves to the DOM, rather
				// than using Rollup's UMD system, so top-level bundles should
				// not be exporting anything. There is *no* valid reason this
				// binding should exist.
				name: "IF_THIS_BINDING_APPEARS_ITS_A_BUG_PLEASE_REPORT_IT_ASAP",
			},
		})
	}

	if (args.configTest) {
		return build("test-utils/index.js", "test-bundle.js")
	} else {
		// TODO: enumerate all the relevant exports
		return [
			// build("index.mjs", "mithril.js"),
			// build("stream/global.mjs", "stream/stream.js"),
		]
	}
}
