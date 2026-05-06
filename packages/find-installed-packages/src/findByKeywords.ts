import path from 'path'
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
  const pkgInfos = findPackagesInfo(cwd)
  const ctimeMs = pkgInfos.reduce((t, p) => t > p.ctimeMs ? t : p.ctimeMs, 0)
  const cacheKey = getCacheKey(keywords, cwd)
  const cache = getCachedPackages(cacheKey, ctimeMs)
  if (cache) return cache

  const packages = Object.keys(pkgInfos.reduce((p, pkg) => {
    const content = readFileSafe(path.resolve(pkg.path, 'package.json'))
    if (!content) return p
    const pjson = JSON.parse(content)
    if (hasAllKeywords(pjson.keywords, keywords)) p[pjson.name] = true
    return p
  }, {} as Record<string, true>))

  setCachedPackages(cacheKey, ctimeMs, packages)
  return packages
}
