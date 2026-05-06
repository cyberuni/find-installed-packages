import a from 'assertron'
import fs from 'fs'
import { getCachedPackages, getCacheKey } from './cachePackages'
import { getCacheFilepath } from './getCacheFilepath'

describe('getCacheKey', () => {
  test('cwd is expanded to absolute path', () => {
    const actual = getCacheKey(['some-key'], '.')
    a.satisfies(JSON.parse(actual), { cwd: /find-installed-packages/, keywords: ['some-key'] })
  })

  test('keywords are sorted', () => {
    const actual = getCacheKey(['b-key', 'a-key'], '.')
    expect(actual.indexOf(JSON.stringify(['a-key', 'b-key'])) >= 0).toBeTruthy()
  })
})

describe('getCachedPackage', () => {
  const filepath = getCacheFilepath()
  fs.writeFileSync(filepath, '{ invalid json')
  expect(getCachedPackages('somkey', 0)).toBeUndefined()
})
