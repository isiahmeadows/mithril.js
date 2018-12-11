"use strict"

const path = require("path")

// This is the raw list of modules.
// Format:
// `{entry: "...", target}` for single bundles
// `{entry: [...], target, shared?}` for split ESM or CJS bundles
const raw = [
	// TODO: enumerate all the relevant exports
	// {entry: "index.mjs", target: "mithril.mjs"},
	// {entry: "stream/global.mjs", target: "stream/stream.js"},
]

class Entry {
	constructor(raw) { this.raw = path.resolve(root, raw) }

	get isESM() {
		return this.raw.endsWith(".mjs")
	}

	get min() {
		return this.raw.endsWith(".mjs") ?
			this.raw.replace(/\.mjs$/, ".min.mjs") :
			this.raw.replace(/\.js$/, ".min.js")
	}
}

const root = path.dirname(__dirname)

exports.sources = raw.map(({target, entry, shared}) => ({
	target: new Entry(target),
	entry: Array.isArray(entry) ? entry.map((e) => new Entry(e)) : new Entry(entry),
	shared: Array.isArray(entry) && shared != null ? new Entry(shared) : undefined,
}))

exports.bundles = exports.sources
	.filter((e) => Array.isArray(e.entry))
	.map((e) => e.target)
