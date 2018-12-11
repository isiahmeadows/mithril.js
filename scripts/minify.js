"use strict"

const fs = require("fs/promises")
const Terser = require("terser")
const modules = require("./modules")

async function main() {
	for (const target of modules.bundles) {
		const data = await fs.readFile(target.raw, "utf-8")
		await fs.writeFile(target.min, Terser.minify(data, {
			module: target.isESM,
			sourceMap: false,
			safari10: true,
		}))
	}
}

if (require.main === module) {
	main().catch(console.error)
}
