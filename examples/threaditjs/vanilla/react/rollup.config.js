import commonjs from "rollup-plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"

export default {
	input: "app.js",
	output: {
		file: "bundle.js",
		type: "iife",
	},
	plugins: [
		nodeResolve(),
		commonjs(),
	],
}
