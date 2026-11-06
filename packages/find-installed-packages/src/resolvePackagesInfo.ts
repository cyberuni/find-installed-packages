import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getPnpApi, type PnpApi } from './getPnpApi'
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
 *
 * `pnp` is the Yarn PnP API to ask first. It defaults to the running process's own.
 */
export async function resolvePackagesInfo(
	cwd: string,
	pnp: PnpApi | undefined = getPnpApi(),
): Promise<ResolvedPackage[] | undefined> {
	const root = path.resolve(cwd)
	const manifest = await readManifest(root)
	if (!manifest) return undefined

	const deps = dependencyNames(manifest, true)
	if (deps.length === 0) return undefined

	const results: ResolvedPackage[] = []
	await walk(root, deps, new Set([root]), results, pnp)
	return results
}

async function walk(
	from: string,
	deps: string[],
	walked: Set<string>,
	results: ResolvedPackage[],
	pnp: PnpApi | undefined,
) {
	await Promise.all(
		deps.map(async (name) => {
			// `@types` packages never carry plugin keywords and are skipped, as they were
			// when this walked the file system.
			if (name.indexOf('@types/') === 0) return

			// Everything up to the first `await` runs synchronously, so resolving and
			// claiming a folder cannot interleave with a concurrent branch.
			const dir = resolvePackageDir(name, from, pnp)
			if (!dir || walked.has(dir)) return
			walked.add(dir)

			const manifest = await readManifest(dir)
			if (!manifest) return
			if (manifest.name) results.push({ name: manifest.name, path: dir, manifest })

			await walk(dir, dependencyNames(manifest, false), walked, results, pnp)
		}),
	)
}

/**
 * Locate the folder of `name` as resolved from `fromDir`.
 *
 * Under Yarn PnP the PnP API answers first. Otherwise two strategies, most faithful
 * first.
 *
 * Note on coverage: Bun's resolver serves `<pkg>/package.json` even when `exports`
 * does not list it, so strategy 1 always wins under `bun test` and strategy 2 reports
 * as uncovered there. It is not dead code: under Node it is what finds an
 * `exports`-restricted package in a `node_modules` tree.
 *
 * There is no third "resolve the entry point and walk up" strategy. `require.resolve`
 * searches exactly the folders `require.resolve.paths()` lists, so in a `node_modules`
 * tree strategy 2 finds anything it could, and under PnP strategy 0 does.
 */
function resolvePackageDir(name: string, fromDir: string, pnp: PnpApi | undefined): string | undefined {
	const issuer = path.join(fromDir, 'package.json')

	// 0. Under PnP, ask where the package lives. Unlike `require.resolve`, this ignores
	// `exports`, so it also finds a package that exposes neither `./package.json` nor a
	// `require` entry — the case strategy 1 misses and strategy 2 cannot reach, since
	// there are no lookup paths under PnP.
	if (pnp) {
		try {
			const dir = pnp.resolveToUnqualified(name, issuer)
			if (dir) return dir
		} catch {
			// not a dependency of `fromDir`; let the strategies below decide
		}
	}

	const require = createRequire(issuer)

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

	return undefined
}
