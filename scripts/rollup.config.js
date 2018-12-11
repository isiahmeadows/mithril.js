"use strict"

const path = require("path")
const commonjs = require("rollup-plugin-commonjs")
const json = require("rollup-plugin-json")
const nodeResolve = require("rollup-plugin-node-resolve")
const modules = require("./modules")

// Our bundles manually install themselves to the DOM, rather
// than using Rollup's UMD system, so top-level bundles should
// not be exporting anything. There is *no* valid reason this
// binding should exist.
const unusedBinding = "IF_THIS_BINDING_APPEARS_ITS_A_BUG_PLEASE_REPORT_IT_ASAP"

module.exports = (args) => {
	const globalOpts = {
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

	if (args.configTest) {
		return {
			...globalOpts,
			input: path.resolve(__dirname, "test-utils/index.js"),
			output: {
				file: path.resolve(__dirname, "test-bundle.js"),
				format: "iife",
				name: unusedBinding,
			},
		}
	} else {
		return modules.sources.map(({entry, target, shared}) => {
			if (!Array.isArray(entry)) {
				return {
					...globalOpts,
					input: entry.raw,
					output: {
						file: target.raw,
						format: "iife",
						name: unusedBinding,
					},
				}
			}
			return {
				...globalOpts,
				experimentalCodeSplitting: true,
				input: entry.map((i) => i.raw),
				output: {
					entryFileNames: target.raw,
					chunkFileNames: shared.raw,
					format: target.isESM ? "esm" : "commonjs"
				},
			}
		})
	}
}
