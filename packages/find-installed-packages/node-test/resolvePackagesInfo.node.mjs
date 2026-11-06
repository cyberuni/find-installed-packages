// Runs under Node, against the build. Bun's resolver serves `<pkg>/package.json` even
// when `exports` hides it, so `bun test` never reaches the `require.resolve.paths()`
// fallback in `resolvePackageDir`. Node does, and this is where it is tested.
//
// Named without `.spec`/`.test` so `bun test` does not pick it up; it lives outside
// `files`, so it is not published.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { findByKeywords } from '../dist/index.mjs'

const testcases = fileURLToPath(new URL('../../../testcases/', import.meta.url))

describe('exports-restricted package in a node_modules tree', () => {
	let root

	before(() => {
		// A fresh copy, so a result cached by an earlier run (`bun test` uses the same
		// cache file and the same testcase) cannot stand in for this one.
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-node-exports-'))
		fs.cpSync(path.join(testcases, 'exports-restricted'), root, { recursive: true })
	})

	after(() => {
		fs.rmSync(root, { recursive: true, force: true })
	})

	test('Node refuses `plugin-e/package.json`, so the first strategy cannot find it', () => {
		const require = createRequire(path.join(root, 'package.json'))
		const name = 'plugin-e'
		assert.throws(() => require.resolve(`${name}/package.json`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
	})

	test('finds it through the lookup paths', async () => {
		assert.deepEqual(await findByKeywords(['some-keyword'], { cwd: root }), ['plugin-e'])
	})
})

describe('exports-restricted package in an isolated store (pnpm)', () => {
	// Built at runtime rather than committed: symlinks do not survive a checkout on
	// Windows without developer mode.
	let root

	before(() => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fip-node-isolated-')))
		const store = path.join(root, 'node_modules', '.store')
		const hidden = { exports: { '.': './index.js' } }

		write(path.join(root, 'package.json'), {
			name: 'testcase-isolated',
			private: true,
			dependencies: { 'plugin-a': '*' },
		})

		// Both packages hide `./package.json`, so the lookup paths are what find them.
		const pluginA = path.join(store, 'plugin-a@1.0.0', 'node_modules', 'plugin-a')
		write(path.join(pluginA, 'package.json'), {
			name: 'plugin-a',
			keywords: ['some-keyword'],
			dependencies: { 'plugin-b': '*' },
			...hidden,
		})
		const pluginB = path.join(store, 'plugin-b@1.0.0', 'node_modules', 'plugin-b')
		write(path.join(pluginB, 'package.json'), { name: 'plugin-b', keywords: ['some-keyword'], ...hidden })

		// plugin-b is reachable only through plugin-a's store folder, not through its
		// top-level link.
		fs.symlinkSync(pluginA, path.join(root, 'node_modules', 'plugin-a'), 'dir')
		fs.symlinkSync(pluginB, path.join(store, 'plugin-a@1.0.0', 'node_modules', 'plugin-b'), 'dir')
	})

	after(() => {
		fs.rmSync(root, { recursive: true, force: true })
	})

	test('reaches its transitive dependency through the store', async () => {
		assert.deepEqual((await findByKeywords(['some-keyword'], { cwd: root })).sort(), ['plugin-a', 'plugin-b'])
	})
})

function write(file, json) {
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, JSON.stringify(json))
	if (path.basename(file) === 'package.json') fs.writeFileSync(path.join(path.dirname(file), 'index.js'), '')
}
