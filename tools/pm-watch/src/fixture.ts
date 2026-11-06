import fs from 'node:fs'
import path from 'node:path'
import type { Cell } from './cells.ts'

/** The keyword the tagged fixture packages carry. */
export const KEYWORD = 'pm-watch-plugin'

/** A project to install and check, inside the fixture root. */
export type Variant = {
	name: 'standalone' | 'workspace'
	/** Where the manager runs `install`. */
	installRoot: string
	/** The `cwd` passed to `findByKeywords`. */
	cwd: string
	/** What `findByKeywords` must return, sorted. */
	expected: string[]
	/** A tagged direct dependency the reinstall step removes, to check the cache notices. */
	dropped: string
}

/**
 * Write the fixture for `cell` under `root` and return the projects to check.
 *
 * Every dependency is a local `file:` package, so nothing is fetched from a registry.
 * Paths are absolute: managers disagree on what a relative `file:` path inside a
 * `file:` dependency is relative to, and that is not what this watch checks.
 *
 * - `plugin-a`: tagged, direct, and depends on `plugin-b`.
 * - `plugin-b`: tagged, reachable only through `plugin-a`.
 * - `plugin-c`: untagged, must not be reported.
 * - `plugin-d`: tagged, and its `exports` hides `./package.json`.
 * - `plugin-ws` (workspace variant only): a tagged sibling workspace.
 */
export function writeFixture(root: string, cell: Cell): Variant[] {
	const pkgs = path.join(root, 'pkgs')
	const dep = (name: string) => `file:${path.join(pkgs, name)}`

	writeJson(path.join(pkgs, 'plugin-a', 'package.json'), {
		name: 'plugin-a',
		version: '1.0.0',
		keywords: [KEYWORD],
		dependencies: { 'plugin-b': dep('plugin-b') },
	})
	writeJson(path.join(pkgs, 'plugin-b', 'package.json'), {
		name: 'plugin-b',
		version: '1.0.0',
		keywords: [KEYWORD],
	})
	writeJson(path.join(pkgs, 'plugin-c', 'package.json'), {
		name: 'plugin-c',
		version: '1.0.0',
		keywords: ['something-else'],
	})
	writeJson(path.join(pkgs, 'plugin-d', 'package.json'), {
		name: 'plugin-d',
		version: '1.0.0',
		keywords: [KEYWORD],
		exports: { '.': './index.js' },
	})
	fs.writeFileSync(path.join(pkgs, 'plugin-d', 'index.js'), 'module.exports = {}\n')

	const dependencies = {
		'plugin-a': dep('plugin-a'),
		'plugin-c': dep('plugin-c'),
		'plugin-d': dep('plugin-d'),
	}

	const standalone = path.join(root, 'standalone')
	writeJson(path.join(standalone, 'package.json'), {
		name: 'pm-watch-standalone',
		version: '0.0.0',
		private: true,
		dependencies,
	})
	writeCellFiles(standalone, cell)

	const workspace = path.join(root, 'workspace')
	writeJson(path.join(workspace, 'package.json'), {
		name: 'pm-watch-workspace',
		version: '0.0.0',
		private: true,
		...(cell.pnpmWorkspace ? {} : { workspaces: ['packages/*'] }),
	})
	if (cell.pnpmWorkspace) {
		fs.writeFileSync(path.join(workspace, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
	}
	writeJson(path.join(workspace, 'packages', 'app', 'package.json'), {
		name: 'app',
		version: '0.0.0',
		private: true,
		dependencies: { ...dependencies, 'plugin-ws': cell.workspaceRange },
	})
	writeJson(path.join(workspace, 'packages', 'plugin-ws', 'package.json'), {
		name: 'plugin-ws',
		version: '1.0.0',
		keywords: [KEYWORD],
	})
	writeCellFiles(workspace, cell)

	return [
		{
			name: 'standalone',
			installRoot: standalone,
			cwd: standalone,
			expected: ['plugin-a', 'plugin-b', 'plugin-d'],
			dropped: 'plugin-d',
		},
		{
			name: 'workspace',
			installRoot: workspace,
			cwd: path.join(workspace, 'packages', 'app'),
			expected: ['plugin-a', 'plugin-b', 'plugin-d', 'plugin-ws'],
			dropped: 'plugin-d',
		},
	]
}

/** Remove `variant.dropped` from the `cwd` manifest and return the new expected set. */
export function dropDependency(variant: Variant): string[] {
	const file = path.join(variant.cwd, 'package.json')
	const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
	delete manifest.dependencies[variant.dropped]
	writeJson(file, manifest)
	return variant.expected.filter((name) => name !== variant.dropped)
}

function writeCellFiles(dir: string, cell: Cell) {
	for (const [name, content] of Object.entries(cell.files ?? {})) {
		fs.writeFileSync(path.join(dir, name), content)
	}
}

function writeJson(file: string, value: unknown) {
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, `${JSON.stringify(value, null, '\t')}\n`)
}
