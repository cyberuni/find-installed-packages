import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findByKeywords } from '.'
import { clearCache } from './cachePackages'
import { resolvePackagesInfo } from './resolvePackagesInfo'

beforeAll(() => {
	clearCache()
})

describe('only declared dependencies are reported', () => {
	test('an installed package that no manifest declares is not returned', async () => {
		// `plugin-u` sits in node_modules without being a dependency of anything.
		// The old folder scan reported it as a side effect of how it walked; a
		// package nothing depends on is not something the caller can load.
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/undeclared' })

		expect(actual).toEqual(['plugin-a'])
	})
})

describe('layouts the node_modules walk could not reach', () => {
	test('finds a hoisted dependency from inside a workspace package', async () => {
		// The tree lives at the workspace root, so `packages/a` has no `node_modules`
		// of its own. This is plain npm/yarn/bun workspace behaviour.
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/workspace/packages/a' })
		expect(actual).toEqual(['plugin-a'])
	})

	test('finds a package that does not expose ./package.json through exports', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/exports-restricted' })
		expect(actual).toEqual(['plugin-e'])
	})

	describe('isolated store (pnpm / bun --linker=isolated)', () => {
		// Built at runtime rather than committed: symlinks do not survive a checkout
		// on Windows without developer mode.
		let root: string

		beforeAll(() => {
			root = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-isolated-'))
			const store = path.join(root, 'node_modules', '.store')

			write(path.join(root, 'package.json'), {
				name: 'testcase-isolated',
				version: '0.0.0',
				private: true,
				dependencies: { 'plugin-a': '*' },
			})

			// plugin-a@1.0.0 depends on plugin-b@1.0.0, each in its own store folder.
			const pluginA = path.join(store, 'plugin-a@1.0.0', 'node_modules', 'plugin-a')
			write(path.join(pluginA, 'package.json'), {
				name: 'plugin-a',
				version: '1.0.0',
				keywords: ['some-keyword'],
				dependencies: { 'plugin-b': '*' },
			})

			const pluginB = path.join(store, 'plugin-b@1.0.0', 'node_modules', 'plugin-b')
			write(path.join(pluginB, 'package.json'), {
				name: 'plugin-b',
				version: '1.0.0',
				keywords: ['some-keyword'],
			})

			// Only the direct dependency is linked at the top level; plugin-b is
			// reachable only through plugin-a's own store folder.
			fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
			fs.symlinkSync(pluginA, path.join(root, 'node_modules', 'plugin-a'), 'dir')
			fs.symlinkSync(pluginB, path.join(store, 'plugin-a@1.0.0', 'node_modules', 'plugin-b'), 'dir')
		})

		afterAll(() => {
			fs.rmSync(root, { recursive: true, force: true })
		})

		test('reaches transitive dependencies through the store', async () => {
			const resolved = await resolvePackagesInfo(root)

			expect(resolved?.map((pkg) => pkg.name).sort()).toEqual(['plugin-a', 'plugin-b'])
		})
	})
})

describe('resolvePackagesInfo', () => {
	test('returns undefined when there is no manifest to resolve from', async () => {
		expect(await resolvePackagesInfo('../../testcases/not-exist')).toBeUndefined()
	})

	test('returns undefined when the manifest declares no dependencies', async () => {
		expect(await resolvePackagesInfo('../../testcases/no-node_modules')).toBeUndefined()
	})

	test('skips dependencies that are declared but not installed', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-missing-'))
		write(path.join(root, 'package.json'), {
			name: 'testcase-missing',
			version: '0.0.0',
			dependencies: { 'not-installed-anywhere': '*' },
		})

		expect(await resolvePackagesInfo(root)).toEqual([])

		fs.rmSync(root, { recursive: true, force: true })
	})
})

function write(filepath: string, content: unknown) {
	fs.mkdirSync(path.dirname(filepath), { recursive: true })
	fs.writeFileSync(filepath, JSON.stringify(content, null, 2))
}
