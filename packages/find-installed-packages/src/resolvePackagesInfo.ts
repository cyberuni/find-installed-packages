import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { dependencyNames, type Manifest, readManifest } from './readManifest'

type ResolvedPackage = { name: string; path: string; manifest: Manifest }

/**
 * Walk the declared dependency graph starting at `cwd`, using the host runtime's
 * module resolver to locate each package.
 *
 * Asking the resolver instead of walking `node_modules` keeps this correct across
 * hoisted layouts (npm, yarn, bun), isolated ones (pnpm, `bun --linker=isolated`),
 * workspaces (where the tree lives at the repo root), and Yarn PnP (where there is
 * no `node_modules` at all).
 *
 * Returns `undefined` when there is nothing to resolve from — no readable
 * `package.json` at `cwd`, or one that declares no dependencies — so the caller
 * can fall back to scanning.
 */
export async function resolvePackagesInfo(cwd: string): Promise<ResolvedPackage[] | undefined> {
	const root = path.resolve(cwd)
	const manifest = await readManifest(root)
	if (!manifest) return undefined

	const deps = dependencyNames(manifest, true)
	if (deps.length === 0) return undefined

	const results: ResolvedPackage[] = []
	await walk(root, deps, new Set([root]), results)
	return results
}

async function walk(from: string, deps: string[], walked: Set<string>, results: ResolvedPackage[]) {
	await Promise.all(
		deps.map(async (name) => {
			// `@types` packages never carry plugin keywords and are skipped, as they were
			// when this walked the file system.
			if (name.indexOf('@types/') === 0) return

			// Everything up to the first `await` runs synchronously, so resolving and
			// claiming a folder cannot interleave with a concurrent branch.
			const dir = resolvePackageDir(name, from)
			if (!dir || walked.has(dir)) return
			walked.add(dir)

			const manifest = await readManifest(dir)
			if (!manifest) return
			if (manifest.name) results.push({ name: manifest.name, path: dir, manifest })

			await walk(dir, dependencyNames(manifest, false), walked, results)
		}),
	)
}

/**
 * Locate the folder of `name` as resolved from `fromDir`.
 *
 * Three strategies, most faithful first, because no single one covers every case.
 *
 * Note on coverage: Bun's resolver serves `<pkg>/package.json` even when `exports`
 * does not list it, so strategy 1 always wins under `bun test` and the fallbacks
 * report as uncovered. They are not dead code — under Node they carry real cases:
 * strategy 2 covers an `exports`-restricted package in a `node_modules` tree, and
 * strategy 3 covers one under Yarn PnP, where `resolve.paths` is not PnP-aware.
 */
function resolvePackageDir(name: string, fromDir: string): string | undefined {
	const require = createRequire(path.join(fromDir, 'package.json'))

	// 1. Ask the resolver directly. Honours PnP, symlinks and workspaces alike.
	try {
		return path.dirname(require.resolve(`${name}/package.json`))
	} catch {
		// the package may not expose `./package.json` through `exports`
	}

	// 2. `exports` can hide `./package.json` even though the package is installed.
	// Look through the resolver's own lookup chain instead, which bypasses `exports`.
	try {
		const lookups = require.resolve.paths(name)
		if (lookups) {
			for (const lookup of lookups) {
				const candidate = path.join(lookup, name)
				if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
			}
		}
	} catch {
		// resolve.paths is unavailable under some resolvers (PnP returns null)
	}

	// 3. Resolve the entry point and walk up to the manifest that declares it.
	try {
		let dir = path.dirname(require.resolve(name))
		for (;;) {
			if (readNameSync(dir) === name) return dir
			const parent = path.dirname(dir)
			if (parent === dir) return undefined
			dir = parent
		}
	} catch {
		// not installed, or not resolvable from here
	}

	return undefined
}

function readNameSync(dir: string): string | undefined {
	try {
		return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name
	} catch {
		return undefined
	}
}
