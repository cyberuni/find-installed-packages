import fs from 'fs'
import path from 'path'

type PackageInfo = { name: string, ctimeMs: number, path: string }

export function findPackagesInfo(cwd: string): PackageInfo[] {
  if (!fs.existsSync(cwd)) return []

  return recurseFind(cwd, {})
}

function recurseFind(cwd: string, walked: Record<string, true>) {
  const nodeModulesDir = path.join(cwd, 'node_modules')
  if (!fs.existsSync(nodeModulesDir)) return []
  if (walked[nodeModulesDir]) return []

  const dirs = fs.readdirSync(nodeModulesDir)
  walked[nodeModulesDir] = true
  return dirs.reduce((p, dir) => {
    const packagePath = path.join(nodeModulesDir, dir)
    const stat = tryStatSync(packagePath)
    if (!stat) return p
    if (!stat.isDirectory()) return p
    walked[packagePath] = true
    if (dir.startsWith('@')) {
      if (dir === '@types') return p
      const subDirs = fs.readdirSync(packagePath)
      subDirs.forEach(sd => {
        const packagePath = path.join(nodeModulesDir, dir, sd)
        if (walked[packagePath]) return
        const stat = tryStatSync(packagePath)
        // istanbul ignore next
        if (!stat) return
        // istanbul ignore next
        if (!stat.isDirectory()) return
        walked[packagePath] = true
        p.push({ name: `${dir}/${sd}`, ctimeMs: stat.ctimeMs, path: packagePath })
        p.push(...recurseFind(packagePath, walked))
      })
    }
    else {
      p.push({ name: dir, ctimeMs: stat.ctimeMs, path: packagePath })
      p.push(...recurseFind(packagePath, walked))
    }

    return p
  }, [] as PackageInfo[])
}

function tryStatSync(path: string) {
  try {
    return fs.statSync(path)
  }
  catch {
    // it fails in Node 14 sometimes, with permission denied.
    // istanbul ignore next
    return undefined
  }
}
