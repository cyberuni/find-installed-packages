import fs from 'node:fs'
import path from 'node:path'
import { getCacheFilepath } from './getCacheFilepath'

type Cache = Record<string, string[]>

export function getCacheKey(keywords: string[], cwd: string): string {
	return JSON.stringify({ cwd: path.resolve(cwd), keywords: keywords.sort() })
}

export function getCachedPackages(key: string, lastCtimeMs: number): string[] | undefined {
	const cache = loadCache()
	const entry = cache[key]
	if (entry) {
		// istanbul ignore next
		if (entry.ctimeMs < lastCtimeMs) {
			delete cache[key]
			saveCache(cache)
			return undefined
		}
		return entry.packages
	}

	return undefined
}

export function setCachedPackages(key: string, ctimeMs: number, packages: string[]) {
	const cache = loadCache()
	cache[key] = { ctimeMs, packages }
	saveCache(cache)
}

// istanbul ignore next
export function clearCache() {
	const filepath = getCacheFilepath()
	if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
}

// istanbul ignore next
function loadCache() {
	const filepath = getCacheFilepath()
	if (!fs.existsSync(filepath)) return {}
	try {
		return JSON.parse(fs.readFileSync(filepath, { encoding: 'utf-8' }))
	} catch (_e) {
		return {}
	}
}

// istanbul ignore next
function saveCache(cache: Cache) {
	const filepath = getCacheFilepath()
	fs.writeFileSync(filepath, JSON.stringify(cache))
}
