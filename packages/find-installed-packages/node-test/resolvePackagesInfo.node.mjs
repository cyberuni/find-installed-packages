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
