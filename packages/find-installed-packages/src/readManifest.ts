import path from 'node:path'
import { readFileSafe } from './readFileSafe'

export type Manifest = {
	name?: string
	keywords?: string[]
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
}

/**
 * Read and parse the `package.json` of a package folder.
 * Returns `undefined` when it is missing, unreadable, or malformed.
 */
export async function readManifest(dir: string): Promise<Manifest | undefined> {
	try {
		const content = await readFileSafe(path.resolve(dir, 'package.json'))
		if (!content) return undefined
		const manifest = JSON.parse(content)
		return manifest && typeof manifest === 'object' ? manifest : undefined
	} catch {
		// unreadable folder or malformed package.json
		return undefined
	}
}

/**
 * Names of the dependencies to traverse from a manifest.
 *
 * `devDependencies` are only installed for the project itself,
 * so they are included at the root and skipped for everything below it.
 */
export function dependencyNames(manifest: Manifest, includeDev: boolean): string[] {
	const names = [
		...keysOf(manifest.dependencies),
		...keysOf(manifest.optionalDependencies),
		...keysOf(manifest.peerDependencies),
		...(includeDev ? keysOf(manifest.devDependencies) : []),
	]
	return Array.from(new Set(names))
}

function keysOf(value: Record<string, string> | undefined): string[] {
	return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : []
}
