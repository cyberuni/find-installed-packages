import fs from 'node:fs'
import path from 'node:path'
import { getCacheFilepath } from './getCacheFilepath'

/** `fingerprint` is the install-tree stamp from `getFingerprint`. */
type CacheEntry = { fingerprint: number; packages: string[] }
type Cache = Record<string, CacheEntry>

let memoryCache: Cache | undefined

export function getCacheKey(keywords: string[], cwd: string): string {
	return JSON.stringify({ cwd: path.resolve(cwd), keywords: [...keywords].sort() })
}

export function getCachedPackages(key: string, fingerprint: number): string[] | undefined {
	const cache = loadCache()
	const entry = cache[key]
	if (entry) {
		// Entries from before the stamp changed have no `fingerprint`. Comparing
		// against `undefined` is always false, which would trust them forever.
		if (typeof entry.fingerprint !== 'number' || entry.fingerprint < fingerprint) {
			delete cache[key]
			saveCache(cache)
			return undefined
		}
		return entry.packages
	}

	return undefined
}

export function setCachedPackages(key: string, fingerprint: number, packages: string[]) {
	const cache = loadCache()
	cache[key] = { fingerprint, packages }
	saveCache(cache)
}

// istanbul ignore next
export function clearCache() {
	memoryCache = undefined
	const filepath = getCacheFilepath()
	if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
}

// istanbul ignore next
function loadCache(): Cache {
	if (memoryCache) return memoryCache
	const filepath = getCacheFilepath()
	if (!fs.existsSync(filepath)) {
		memoryCache = {}
		return memoryCache
	}
	try {
		memoryCache = JSON.parse(fs.readFileSync(filepath, { encoding: 'utf-8' }))
		return memoryCache!
	} catch (_e) {
		memoryCache = {}
		return memoryCache
	}
}

// istanbul ignore next
function saveCache(cache: Cache) {
	memoryCache = cache
	const filepath = getCacheFilepath()
	fs.writeFileSync(filepath, JSON.stringify(cache))
}
