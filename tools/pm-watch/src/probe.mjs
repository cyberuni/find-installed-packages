// Runs under the runtime being checked (Node, Bun, or Node inside Yarn's PnP runtime),
// calls the built package, and prints one JSON line for `check.ts` to read.
// Plain JavaScript, so every runtime can load it without a TypeScript step.
//
// Usage: <runtime> probe.mjs <path to dist/index.mjs, or a package name> <cwd> <keyword>
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [dist, cwd, keyword] = process.argv.slice(2)
if (!dist || !cwd || !keyword) {
	console.error('usage: probe.mjs <dist> <cwd> <keyword>')
	process.exit(2)
}

// A path loads that file. Anything else is a package name, resolved from where this file sits.
const { findByKeywords } = await import(path.isAbsolute(dist) ? pathToFileURL(dist).href : dist)
const packages = await findByKeywords([keyword], { cwd })

console.log(
	JSON.stringify({
		packages,
		runtime: process.versions['deno']
			? `deno ${process.versions['deno']}`
			: process.versions['bun']
				? `bun ${process.versions['bun']}`
				: `node ${process.version}`,
		pnp: Boolean(process.versions['pnp']),
	}),
)
