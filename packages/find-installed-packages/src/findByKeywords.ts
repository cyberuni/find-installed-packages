import { unpartial } from 'unpartial'
import { getCachedPackages, getCacheKey, setCachedPackages } from './cachePackages'
import { findPackagesInfo } from './findPackagesInfo'
import { getFingerprint } from './getFingerprint'
import { hasAllKeywords } from './hasAllKeywords'
import { type Manifest, readManifest } from './readManifest'
import { resolvePackagesInfo } from './resolvePackagesInfo'

export async function findByKeywords(keywords: string[], options?: { cwd?: string }) {
	const { cwd } = unpartial({ cwd: '.' }, options)

	return getPackages(keywords, cwd)
}

async function getPackages(keywords: string[], cwd: string) {
	const cacheKey = getCacheKey(keywords, cwd)
	const fingerprint = await getFingerprint(cwd)
	const cache = getCachedPackages(cacheKey, fingerprint)
	if (cache) return cache

	const manifests = await collectManifests(cwd)
	const names = manifests
		.filter((manifest) => manifest.name && hasAllKeywords(manifest.keywords, keywords))
		.map((manifest) => manifest.name as string)

	const packages = Array.from(new Set(names))

	setCachedPackages(cacheKey, fingerprint, packages)
	return packages
}

/**
 * Prefer the dependency graph as the runtime resolves it.
 * Fall back to scanning `node_modules` when there is nothing to resolve from —
 * no readable manifest at `cwd`, or one without dependencies.
 */
async function collectManifests(cwd: string): Promise<Manifest[]> {
	const resolved = await resolvePackagesInfo(cwd)
	if (resolved) return resolved.map((pkg) => pkg.manifest)

	const infos = await findPackagesInfo(cwd)
	const manifests = await Promise.all(infos.map((info) => readManifest(info.path)))
	return manifests.filter((manifest): manifest is Manifest => !!manifest)
}
