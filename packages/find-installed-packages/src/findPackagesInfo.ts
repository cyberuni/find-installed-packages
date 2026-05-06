import fs from 'node:fs'
import path from 'node:path'

type PackageInfo = { name: string; ctimeMs: number; path: string }

export async function findPackagesInfo(cwd: string): Promise<PackageInfo[]> {
	try {
		await fs.promises.access(cwd)
	} catch {
		return []
	}

	return recurseFind(cwd, {})
}

async function recurseFind(cwd: string, walked: Record<string, true>): Promise<PackageInfo[]> {
	const nodeModulesDir = path.join(cwd, 'node_modules')
	if (walked[nodeModulesDir]) return []
	// Mark before the first await to prevent concurrent calls from processing the same dir
	walked[nodeModulesDir] = true

	try {
		await fs.promises.access(nodeModulesDir)
	} catch {
		return []
	}

	const dirs = await fs.promises.readdir(nodeModulesDir)
	const results: PackageInfo[] = []

	await Promise.all(
		dirs.map(async (dir) => {
			const packagePath = path.join(nodeModulesDir, dir)
			const stat = await tryStatAsync(packagePath)
			if (!stat) return
			if (!stat.isDirectory()) return
			walked[packagePath] = true

			if (dir.startsWith('@')) {
				if (dir === '@types') return
				const subDirs = await fs.promises.readdir(packagePath)
				await Promise.all(
					subDirs.map(async (sd) => {
						const subPackagePath = path.join(nodeModulesDir, dir, sd)
						if (walked[subPackagePath]) return
						const subStat = await tryStatAsync(subPackagePath)
						// istanbul ignore next
						if (!subStat) return
						// istanbul ignore next
						if (!subStat.isDirectory()) return
						walked[subPackagePath] = true
						results.push({ name: `${dir}/${sd}`, ctimeMs: subStat.ctimeMs, path: subPackagePath })
						const nested = await recurseFind(subPackagePath, walked)
						results.push(...nested)
					}),
				)
			} else {
				results.push({ name: dir, ctimeMs: stat.ctimeMs, path: packagePath })
				const nested = await recurseFind(packagePath, walked)
				results.push(...nested)
			}
		}),
	)

	return results
}

async function tryStatAsync(filePath: string) {
	try {
		return await fs.promises.stat(filePath)
	} catch {
		// it fails in Node 14 sometimes, with permission denied.
		// istanbul ignore next
		return undefined
	}
}
