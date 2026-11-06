// Runs under the runtime being checked (Node, Bun, or Node inside Yarn's PnP runtime),
// calls the built package, and prints one JSON line for `check.ts` to read.
// Plain JavaScript, so every runtime can load it without a TypeScript step.
//
// Usage: <runtime> probe.mjs <path to dist/index.mjs> <cwd> <keyword>
import { pathToFileURL } from 'node:url'

const [dist, cwd, keyword] = process.argv.slice(2)
if (!dist || !cwd || !keyword) {
	console.error('usage: probe.mjs <dist> <cwd> <keyword>')
	process.exit(2)
}

const { findByKeywords } = await import(pathToFileURL(dist).href)
const packages = await findByKeywords([keyword], { cwd })

console.log(
	JSON.stringify({
		packages,
		runtime: process.versions['bun'] ? `bun ${process.versions['bun']}` : `node ${process.version}`,
		pnp: Boolean(process.versions['pnp']),
	}),
)
