import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getPnpApi, type PnpApi } from './getPnpApi'
import { dependencyNames, type Manifest, readManifest } from './readManifest'

type ResolvedPackage = { name: string; path: string; manifest: Manifest }

/** The folders `require.resolve.paths(name)` lists when resolving from the file `issuer`. */
export type LookupPaths = (name: string, issuer: string) => string[] | null | undefined

const resolverLookupPaths: LookupPaths = (name, issuer) => createRequire(issuer).resolve.paths(name)

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
 * `lookupPaths` lists where strategy 2 looks. It defaults to the resolver's own, and exists
 * so a spec can supply the shape of a runtime this suite cannot run, such as Deno's.
 */
export async function resolvePackagesInfo(
	cwd: string,
	pnp: PnpApi | undefined = getPnpApi(),
	lookupPaths: LookupPaths = resolverLookupPaths,
): Promise<ResolvedPackage[] | undefined> {
	const root = path.resolve(cwd)
	const manifest = await readManifest(root)
	if (!manifest) return undefined

	const deps = dependencyNames(manifest, true)
	if (deps.length === 0) return undefined

	const results: ResolvedPackage[] = []
	await walk(root, deps, new Set([root]), results, pnp, lookupPaths)
	return results
}

async function walk(
	from: string,
	deps: string[],
	walked: Set<string>,
	results: ResolvedPackage[],
	pnp: PnpApi | undefined,
	lookupPaths: LookupPaths,
) {
	await Promise.all(
		deps.map(async (name) => {
			// `@types` packages never carry plugin keywords and are skipped, as they were
			// when this walked the file system.
			if (name.indexOf('@types/') === 0) return

			// Everything up to the first `await` runs synchronously, so resolving and
			// claiming a folder cannot interleave with a concurrent branch.
			const dir = resolvePackageDir(name, from, pnp, lookupPaths)
			if (!dir || walked.has(dir)) return
			walked.add(dir)

			const manifest = await readManifest(dir)
			if (!manifest) return
			if (manifest.name) results.push({ name: manifest.name, path: dir, manifest })

			await walk(dir, dependencyNames(manifest, false), walked, results, pnp, lookupPaths)
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
 * `exports`-restricted package in a `node_modules` tree. `node-test/` runs it against
 * the build under Node, and that run's coverage is uploaded alongside Bun's.
 *
 * Strategy 2 accepts a lookup in either of two shapes. Usually the lookup is a
 * `node_modules` folder holding `<name>`. Under Deno with `nodeModulesDir: "none"` the
 * packages live in Deno's global cache, and `require.resolve.paths(name)` starts with the
 * package's own cache folder, so the lookup itself is the package. It is accepted only when
 * its `package.json` names `name`, so an unrelated folder in the chain is never taken for it.
 *
 * There is no third "resolve the entry point and walk up" strategy. `require.resolve`
 * searches exactly the folders `require.resolve.paths()` lists, so in a `node_modules`
 * tree strategy 2 finds anything it could, and under PnP strategy 0 does.
 */
function resolvePackageDir(
	name: string,
	fromDir: string,
	pnp: PnpApi | undefined,
	lookupPaths: LookupPaths,
): string | undefined {
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
		const lookups = lookupPaths(name, issuer)
		if (lookups) {
			for (const lookup of lookups) {
				// The lookup may be the package folder itself (Deno, `nodeModulesDir: "none"`).
				if (isPackageFolder(lookup, name)) return fs.realpathSync(lookup)

				const candidate = path.join(lookup, name)
				// The real folder, as strategy 1 returns. In an isolated store `candidate` is a
				// symlink, and the package's own dependencies are found only from its store folder.
				if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate)
			}
		}
	} catch {
		// resolve.paths is unavailable under some resolvers (PnP returns null)
	}

	return undefined
}

/** Whether `dir` holds a `package.json` that names `name`. */
function isPackageFolder(dir: string, name: string): boolean {
	try {
		return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name === name
	} catch {
		return false
	}
}
