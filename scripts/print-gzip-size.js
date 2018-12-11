"use strict"

// Invoked as `node scripts/print-gzip-size [ --save ]`
// Prints original + gzipped size for all the modules and their corresponding
// minified bundles, and optionally saves the first to `README.md`
const util = require("util")
const {createReadStream} = require("fs")
const fs = require("fs/promises")
const stream = require("stream")
const path = require("path")
const zlib = require("zlib")
const modules = require("./modules")

function format(len) {
	return String(len).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")
}

async function main({save}) {
	let firstGzip

	for (const {raw, min} of modules.bundles) {
		let rawGzip = 0, minGzip = 0
		const [{size: rawSize}, {size: minSize}] = await Promise.all([
			fs.stat(raw), fs.stat(min),
			util.promisify(stream.finished)(
				stream.pipeline(createReadStream(raw), zlib.createGzip())
					.on("data", (buf) => { rawGzip += buf.byteLength })
			),
			util.promisify(stream.finished)(
				stream.pipeline(createReadStream(min), zlib.createGzip())
					.on("data", (buf) => { minGzip += buf.byteLength })
			),
		])

		console.log(path.relative(path.resolve(process.cwd()), raw) + ":")
		console.log(
			`  Original size: ${format(rawGzip)} bytes gzipped ` +
		`(${format(rawSize)} bytes uncompressed)`
		)
		console.log(
			`  Compressed size: ${format(minGzip)} bytes gzipped ` +
		`(${format(minSize)} bytes uncompressed)`
		)

		if (firstGzip == null) firstGzip = minGzip
	}

	if (save) {
		const src = await fs.readFile("README.md", "utf-8")
		await fs.writeFile("README.md", src.replace(
			/(<!-- size -->)(.+?)(<!-- \/size -->)/,
			`$1${(firstGzip / 1024).toFixed(2)} KB$3`
		))
	}
}

if (require.main === module) {
	main({save: process.argv.includes("--save", 2)}).catch(console.error)
}
