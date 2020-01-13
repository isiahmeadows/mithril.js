import commonjs from "rollup-plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"
import svelte from "rollup-plugin-svelte"

export default {
    input: "app.svelte",
    output: {
        file: "bundle.js",
        type: "iife",
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        svelte(),
    ],
}
