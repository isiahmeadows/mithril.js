"use strict"

const path = require("path");
const nodeResolve = require("@rollup/plugin-node-resolve");

module.exports = {
    input: path.resolve(__dirname, "../temp/stream.ts"),
    output: {
        format: "umd",
        name: "Mithril.Stream",
        amd: {
            id: "mithril/stream",
        }
    },
    plugins: [nodeResolve()],
};
