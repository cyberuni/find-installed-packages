import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findByKeywords } from '.'
import { clearCache } from './cachePackages'
import { getPnpApi } from './getPnpApi'
import { type LookupPaths, resolvePackagesInfo } from './resolvePackagesInfo'

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

	describe('real `bun install --linker=isolated`', () => {
		// The store above is hand-built. This one is laid out by bun itself, so a change
		// in bun's store shape shows up here. Every dependency is a local `file:` package,
		// and the registry points at a closed port, so the install never goes online.
		let root: string

		beforeAll(() => {
			root = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-bun-isolated-'))

			write(path.join(root, 'package.json'), {
				name: 'testcase-bun-isolated',
				version: '0.0.0',
				private: true,
				dependencies: { 'plugin-a': 'file:./pkgs/plugin-a', 'plugin-c': 'file:./pkgs/plugin-c' },
			})
			write(path.join(root, 'pkgs', 'plugin-a', 'package.json'), {
				name: 'plugin-a',
				version: '1.0.0',
				keywords: ['some-keyword'],
				dependencies: { 'plugin-b': 'file:../plugin-b' },
			})
			write(path.join(root, 'pkgs', 'plugin-b', 'package.json'), {
				name: 'plugin-b',
				version: '1.0.0',
				keywords: ['some-keyword'],
			})
			write(path.join(root, 'pkgs', 'plugin-c', 'package.json'), { name: 'plugin-c', version: '1.0.0' })

			// The repo's release soak is repeated here to show it does not apply to `file:` deps.
			fs.writeFileSync(
				path.join(root, 'bunfig.toml'),
				'[install]\nregistry = "http://127.0.0.1:9/"\nminimumReleaseAge = 86400\n',
			)

			const install = Bun.spawnSync([process.execPath, 'install', '--linker=isolated'], {
				cwd: root,
				stdout: 'pipe',
				stderr: 'pipe',
			})
			if (install.exitCode !== 0) {
				throw new Error(`bun install --linker=isolated failed:\n${install.stderr.toString()}`)
			}
		})

		afterAll(() => {
			fs.rmSync(root, { recursive: true, force: true })
		})

		test('the transitive dependency is reachable only through the store', () => {
			// Guards the premise: if bun ever hoists plugin-b, this test no longer covers the store.
			expect(fs.existsSync(path.join(root, 'node_modules', 'plugin-b'))).toBe(false)
		})

		test('finds direct and transitive keyword packages', async () => {
			const actual = await findByKeywords(['some-keyword'], { cwd: root })

			expect(actual.sort()).toEqual(['plugin-a', 'plugin-b'])
		})
	})
})

describe('Yarn PnP', () => {
	// There is no `node_modules` anywhere in this tree, as under PnP: the packages sit
	// in their own folders (standing in for `.yarn/cache/*.zip/node_modules/<name>`), and
	// only the stubbed PnP API knows where each one is. A real Yarn install is verified
	// by hand; CI cannot run one without fetching Yarn and an install over the network.
	let root: string
	let pnp: { resolveToUnqualified(request: string, issuer: string): string | null }

	beforeAll(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-pnp-'))
		const cache = path.join(root, '.yarn', 'cache')
		const dirOf = (name: string) => path.join(cache, `${name}.zip`, 'node_modules', name)

		write(path.join(root, 'package.json'), {
			name: 'testcase-pnp',
			version: '0.0.0',
			private: true,
			dependencies: { 'plugin-a': '*', 'plugin-hidden': '*' },
		})
		write(path.join(dirOf('plugin-a'), 'package.json'), {
			name: 'plugin-a',
			version: '1.0.0',
			keywords: ['some-keyword'],
			dependencies: { 'plugin-shared': '*' },
		})
		// `exports` hides both `./package.json` and any `require` entry. Under
		// `node_modules` the resolver's lookup paths still find it; under PnP they do not exist.
		write(path.join(dirOf('plugin-hidden'), 'package.json'), {
			name: 'plugin-hidden',
			version: '1.0.0',
			keywords: ['some-keyword'],
			exports: { './sub': './sub.js' },
			dependencies: { 'plugin-shared': '*' },
		})
		// Reached through two dependents; reported once.
		write(path.join(dirOf('plugin-shared'), 'package.json'), {
			name: 'plugin-shared',
			version: '1.0.0',
			keywords: ['some-keyword'],
		})

		// Each issuer sees only what it declares, as under PnP.
		const graph: Record<string, Record<string, string>> = {
			[root]: { 'plugin-a': dirOf('plugin-a'), 'plugin-hidden': dirOf('plugin-hidden') },
			[dirOf('plugin-a')]: { 'plugin-shared': dirOf('plugin-shared') },
			[dirOf('plugin-hidden')]: { 'plugin-shared': dirOf('plugin-shared') },
		}
		pnp = {
			resolveToUnqualified(request, issuer) {
				const dir = graph[path.dirname(issuer)]?.[request]
				if (!dir) throw new Error(`${request} is not a dependency of ${issuer}`)
				return dir
			},
		}
	})

	afterAll(() => {
		fs.rmSync(root, { recursive: true, force: true })
	})

	test('finds every declared package through the PnP API, each once', async () => {
		const resolved = await resolvePackagesInfo(root, pnp)

		expect(resolved?.map((pkg) => pkg.name).sort()).toEqual(['plugin-a', 'plugin-hidden', 'plugin-shared'])
	})

	test('reports the folder the PnP API names', async () => {
		const resolved = await resolvePackagesInfo(root, pnp)
		const hidden = resolved?.find((pkg) => pkg.name === 'plugin-hidden')

		expect(hidden?.path).toBe(path.join(root, '.yarn', 'cache', 'plugin-hidden.zip', 'node_modules', 'plugin-hidden'))
		expect(hidden?.manifest.keywords).toEqual(['some-keyword'])
	})
})

describe('Deno\'s global cache (`nodeModulesDir: "none"`)', () => {
	// There is no `node_modules`: each package sits in its own cache folder, and
	// `require.resolve.paths(name)` starts with that folder rather than a `node_modules`
	// above it. The real Deno is checked by the weekly watch (`tools/pm-watch`, cell
	// `deno-none`); CI cannot run it here, so the lookups are supplied.
	let root: string
	let lookups: LookupPaths
	const cacheOf = (name: string) => path.join(root, 'deno-dir', 'npm', 'registry', name, '1.0.0')

	beforeAll(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-deno-none-'))
		write(path.join(root, 'package.json'), {
			name: 'testcase-deno-none',
			version: '0.0.0',
			private: true,
			dependencies: { 'plugin-hidden': '*', 'plugin-require': '*', 'plugin-a': '*', 'plugin-liar': '*' },
		})
		// `exports` hides `./package.json`, with no `require` entry and with one.
		write(path.join(cacheOf('plugin-hidden'), 'package.json'), {
			name: 'plugin-hidden',
			version: '1.0.0',
			keywords: ['some-keyword'],
			exports: { '.': { import: './index.js' } },
		})
		write(path.join(cacheOf('plugin-require'), 'package.json'), {
			name: 'plugin-require',
			version: '1.0.0',
			keywords: ['some-keyword'],
			exports: { '.': { require: './index.js' } },
		})
		write(path.join(cacheOf('plugin-a'), 'package.json'), {
			name: 'plugin-a',
			version: '1.0.0',
			keywords: ['some-keyword'],
			dependencies: { 'plugin-transitive': '*' },
		})
		write(path.join(cacheOf('plugin-transitive'), 'package.json'), {
			name: 'plugin-transitive',
			version: '1.0.0',
			keywords: ['some-keyword'],
		})
		// A folder in the lookups whose manifest names another package. Never taken for `plugin-liar`.
		write(path.join(cacheOf('plugin-other'), 'package.json'), {
			name: 'plugin-other',
			version: '1.0.0',
			keywords: ['some-keyword'],
		})

		lookups = (name) => [
			name === 'plugin-liar' ? cacheOf('plugin-other') : cacheOf(name),
			path.join(root, 'node_modules'),
			path.join(path.dirname(root), 'node_modules'),
		]
	})

	afterAll(() => {
		fs.rmSync(root, { recursive: true, force: true })
	})

	test('finds a package whose lookup is its own folder, with or without a `require` entry', async () => {
		const resolved = await resolvePackagesInfo(root, undefined, lookups)

		expect(resolved?.map((pkg) => pkg.name).sort()).toEqual([
			'plugin-a',
			'plugin-hidden',
			'plugin-require',
			'plugin-transitive',
		])
	})

	test('reports the cache folder as the package path', async () => {
		const resolved = await resolvePackagesInfo(root, undefined, lookups)

		expect(resolved?.find((pkg) => pkg.name === 'plugin-hidden')?.path).toBe(fs.realpathSync(cacheOf('plugin-hidden')))
	})

	test('does not take a lookup folder for a package its manifest does not name', async () => {
		const resolved = await resolvePackagesInfo(root, undefined, lookups)

		expect(resolved?.some((pkg) => pkg.name === 'plugin-other')).toBe(false)
	})
})

describe('getPnpApi', () => {
	test('is undefined outside Yarn PnP', () => {
		expect(process.versions['pnp']).toBeUndefined()
		expect(getPnpApi()).toBeUndefined()
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
