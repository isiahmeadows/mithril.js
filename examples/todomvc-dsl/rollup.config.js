import path from "path"
import alias from "rollup-plugin-alias"
import commonjs from "rollup-plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"

const mithrilPath =
    path.resolve(__dirname, "../../packages/mithril/dist/index.mjs")

export default {
    input: "todomvc.mjs",
    output: {
        file: "bundle.js",
        type: "iife",
    },
    plugins: [
        alias({entries: {mithril: mithrilPath}}),
        nodeResolve(),
        commonjs(),
    ],
}
