import path from 'node:path'
import { unpartial } from 'unpartial'
import { getCachedPackages, getCacheKey, setCachedPackages } from './cachePackages'
import { findPackagesInfo } from './findPackagesInfo'
import { hasAllKeywords } from './hasAllKeywords'
import { readFileSafe } from './readFileSafe'

export async function findByKeywords(keywords: string[], options?: { cwd?: string }) {
	const { cwd } = unpartial({ cwd: '.' }, options)

	return getPackages(keywords, cwd)
}

async function getPackages(keywords: string[], cwd: string) {
	const pkgInfos = await findPackagesInfo(cwd)
	const ctimeMs = pkgInfos.reduce((t, p) => (t > p.ctimeMs ? t : p.ctimeMs), 0)
	const cacheKey = getCacheKey(keywords, cwd)
	const cache = getCachedPackages(cacheKey, ctimeMs)
	if (cache) return cache

	const names = await Promise.all(
		pkgInfos.map(async (pkg) => {
			const content = await readFileSafe(path.resolve(pkg.path, 'package.json'))
			if (!content) return undefined
			try {
				const pjson = JSON.parse(content)
				if (hasAllKeywords(pjson.keywords, keywords)) return pjson.name as string
			} catch {
				// skip malformed package.json
			}
			return undefined
		}),
	)

	const packages = Array.from(new Set(names.filter((n): n is string => n !== undefined)))

	setCachedPackages(cacheKey, ctimeMs, packages)
	return packages
}
