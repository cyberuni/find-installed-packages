import fs from 'node:fs'
import path from 'node:path'
import { LOCKS } from 'package-manager-detector/constants'

/**
 * Yarn Plug'n'Play has no lockfile in `LOCKS`, but these change with the
 * installed tree the same way one does.
 */
const PNP_FILES = ['.pnp.cjs', '.pnp.data.json']

/**
 * Files that change whenever the installed tree changes.
 *
 * The lockfile names come from `package-manager-detector` rather than a list of
 * our own, so new package managers arrive with a dependency bump instead of a
 * bug report.
 */
const LOCKFILES = Object.keys(LOCKS).concat(PNP_FILES)

/**
 * A cheap number that changes when the installed tree changes.
 *
 * Used as the cache stamp. Unlike stat-ing every installed package, this is a
 * handful of `stat` calls, so the cache can short-circuit the whole walk rather
 * than only the manifest reads.
 *
 * The lockfile is looked up from `cwd` upwards, because in a workspace it lives
 * at the repo root rather than next to the project.
 */
export async function getFingerprint(cwd: string): Promise<number> {
	const root = path.resolve(cwd)
	let fingerprint = 0

	const bump = (stat: fs.Stats | undefined) => {
		if (stat && stat.mtimeMs > fingerprint) fingerprint = stat.mtimeMs
	}

	// The project's own manifest and top-level tree, so hand-edits are noticed too.
	bump(await statSafe(path.join(root, 'package.json')))
	bump(await statSafe(path.join(root, 'node_modules')))

	let dir = root
	for (;;) {
		const stats = await Promise.all(LOCKFILES.map((name) => statSafe(path.join(dir, name))))
		const found = stats.filter((stat): stat is fs.Stats => !!stat)
		if (found.length > 0) {
			found.forEach(bump)
			break
		}
		const parent = path.dirname(dir)
		if (parent === dir) break
		dir = parent
	}

	return fingerprint
}

async function statSafe(filepath: string) {
	try {
		return await fs.promises.stat(filepath)
	} catch {
		return undefined
	}
}
