import { expect, test } from 'bun:test'
import a from 'assertron'
import { findPackagesInfo } from './findPackagesInfo'

test('node_modules in test folder will not take into consideration', async () => {
	const packagesInfo = await findPackagesInfo('../../testcases/node_modules-in-test')

	a.satisfies(packagesInfo, [{ name: 'pkg-with-test' }])
})

test('folder without node_modules will not considered', async () => {
	const packagesInfo = await findPackagesInfo('../../testcases/no-node_modules')

	expect(packagesInfo.length).toBe(0)
})
