import babel from "rollup-plugin-babel"
import commonjs from "rollup-plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"

export default {
	input: "app.js",
	output: {
		file: "bundle.js",
		type: "iife",
	},
	plugins: [
		babel({exclude: "node_modules/**"}),
		nodeResolve(),
		commonjs(),
	],
}
