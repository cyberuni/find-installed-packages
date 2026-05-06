import { beforeAll, describe, expect, it, test } from 'bun:test'
import { findByKeywords } from '.'
import { clearCache } from './cachePackages'

beforeAll(() => {
	clearCache()
})

describe('find local', () => {
	test('not exist folder returns empty array', async () => {
		const actual = await findByKeywords(['not-exist-keyword'], { cwd: '../../testcases/not-exist' })
		expect(actual).toEqual([])
	})

	test('no node_modues folder returns empty array', async () => {
		const actual = await findByKeywords(['not-exist-keyword'], { cwd: '../../testcases/no-node_modules' })
		expect(actual).toEqual([])
	})

	test('no package containing keyword returns empty array', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/no-keyword' })
		expect(actual).toEqual([])
	})

	test('find package containing specified keyword', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/one-plugin' })
		expect(actual).toEqual(['plugin-a'])
	})

	test('package does not contain all keywords do not return', async () => {
		const actual = await findByKeywords(['some-keyword', 'another-keyword'], { cwd: '../../testcases/one-plugin' })
		expect(actual).toEqual([])
	})

	test('find package contains all keywords', async () => {
		const actual = await findByKeywords(['some-keyword', 'another-keyword'], { cwd: '../../testcases/multi-keywords' })
		expect(actual).toEqual(['plugin-m'])
	})

	test('find scoped package containing specified keyword', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/scoped-one-plugin' })
		expect(actual).toEqual(['@some-scope/plugin-a'])
	})

	test('scoped package does not contain all keywords do not return', async () => {
		const actual = await findByKeywords(['some-keyword', 'another-keyword'], {
			cwd: '../../testcases/scoped-one-plugin',
		})
		expect(actual).toEqual([])
	})

	test('find package in nested node_modules', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/nested-one-plugin' })
		expect(actual).toEqual(['plugin-a'])
	})

	test('find scoped package in nested node_modules', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/nested-scoped-one-plugin' })
		expect(actual).toEqual(['@some-scope/plugin-a'])
	})

	test('@types is ignored', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/at-types-plugin' })
		expect(actual).toEqual([])
	})

	test('should not get package not under top node_modules hierarchy', async () => {
		const packagesInfo = await findByKeywords(['some-keyword'])

		expect(packagesInfo).toEqual([])
	})

	test('ignore files under node_modules', async () => {
		const packagesInfo = await findByKeywords(['some'], { cwd: '../../testcases/node_modules-with-file' })
		expect(packagesInfo.length).toBe(0)
	})

	test('find again loads from cache', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/nested-scoped-one-plugin' })
		expect(actual).toEqual(['@some-scope/plugin-a'])
	})

	it('should returns unique list', async () => {
		const actual = await findByKeywords(['some-keyword'], { cwd: '../../testcases/recursive' })
		expect(actual).toEqual(['@some-scope/plugin-a'])
	})
})
