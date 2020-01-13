import commonjs from "rollup-plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"
import vue from "rollup-plugin-vue"

export default {
    input: "app.mjs",
    output: {
        file: "bundle.js",
        type: "iife",
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        vue(),
    ],
}
