#!/usr/bin/env node
// Install a fixture with any package manager and run the built package against it.
//
//   node .agents/skills/pm-gap-scan/probe.mjs --install "<cmd>" [--run "<cmd>"]
//     [--layout single|workspace] [--file <path>=<content>]... [--keep]
//
// The fixture depends on `find-installed-packages` (packed from this repo's built `dist`)
// and on five probe plugins. Everything is served by a throwaway local registry, so each
// manager installs through its normal registry path. A `file:` dependency would not do:
// npm links one without installing its dependencies. Names this registry does not hold
// are forwarded to registry.npmjs.org.
//
// Prints one JSON report and exits 0 when the packages found match the expected set.

import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const pkgDir = path.join(repo, 'packages', 'find-installed-packages')
const KEYWORD = 'fip-probe'
const OLD = '2020-01-01T00:00:00.000Z'

// What the fixture declares, and what a correct run reports.
const PLUGINS = [
	{ name: 'plugin-a', keywords: [KEYWORD], dependencies: { 'plugin-b': '^1.0.0' } },
	{ name: 'plugin-b', keywords: [KEYWORD] },
	// ESM only, and `exports` hides both `./package.json` and any `require` entry.
	{
		name: 'plugin-hidden',
		keywords: [KEYWORD],
		type: 'module',
		exports: { '.': { import: './index.js' } },
	},
	{ name: '@fip-probe/plugin-s', keywords: [KEYWORD] },
	// No keyword. Shares plugin-b with plugin-a.
	{ name: 'plugin-c', dependencies: { 'plugin-b': '^1.0.0' } },
]
const DIRECT = ['plugin-a', 'plugin-hidden', '@fip-probe/plugin-s', 'plugin-c']
const EXPECTED = ['@fip-probe/plugin-s', 'plugin-a', 'plugin-b', 'plugin-hidden']

const args = parseArgs(process.argv.slice(2))
const report = await probe(args)
console.log(JSON.stringify(report, null, 2))
process.exit(report.pass ? 0 : 1)

async function probe({ install, run, layout, files, keep }) {
	const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-probe-'))
	const tarballs = path.join(work, 'tarballs')
	const root = path.join(work, 'project')
	fs.mkdirSync(tarballs, { recursive: true })

	const packages = packFixtures(work, tarballs)
	const server = await startRegistry(packages)
	const registry = `http://127.0.0.1:${server.address().port}/`

	try {
		const app = writeProject(root, layout, packages.get('find-installed-packages').version, files, registry)
		const env = registryEnv(registry, work)

		const before = new Set(listRoot(root))
		const installed = await sh(install, root, env)
		const after = listRoot(root)
		const created = after.filter((entry) => !before.has(entry))

		const ran = installed.code === 0 ? await sh(`${run} probe-run.mjs`, app, env) : undefined
		const result = ran ? parseResult(ran.stdout) : undefined
		const found = result?.found ? [...result.found].sort() : undefined

		return {
			pass: !!found && JSON.stringify(found) === JSON.stringify(EXPECTED),
			install,
			run,
			layout,
			files: Object.keys(files),
			managerVersion: await managerVersion(install, root, env),
			runtime: result?.versions,
			expected: EXPECTED,
			found,
			missing: found ? EXPECTED.filter((name) => !found.includes(name)) : undefined,
			unexpected: found ? found.filter((name) => !EXPECTED.includes(name)) : undefined,
			nodeModules: fs.existsSync(path.join(root, 'node_modules')),
			// Every root entry the install created, and whether the cache fingerprint watches it.
			created: created.map((entry) => ({ entry, watched: isWatched(entry) })),
			installExit: installed.code,
			installTail: installed.code === 0 ? undefined : tail(`${installed.stdout}\n${installed.stderr}`),
			runExit: ran?.code,
			runTail: ran && (ran.code !== 0 || !result) ? tail(`${ran.stdout}\n${ran.stderr}`) : undefined,
			workdir: keep ? work : undefined,
		}
	} finally {
		server.close()
		if (!keep) fs.rmSync(work, { recursive: true, force: true })
	}
}

/** Pack the probe plugins and this repo's built package into `tarballs`. */
function packFixtures(work, tarballs) {
	if (!fs.existsSync(path.join(pkgDir, 'dist', 'index.mjs'))) {
		throw new Error('packages/find-installed-packages/dist is missing. Run `bun run build` first.')
	}

	const sources = path.join(work, 'sources')
	const dirs = [pkgDir]
	for (const plugin of PLUGINS) {
		const dir = path.join(sources, plugin.name)
		writeJson(path.join(dir, 'package.json'), { version: '1.0.0', ...plugin })
		fs.writeFileSync(
			path.join(dir, 'index.js'),
			plugin.type === 'module' ? 'export default 1\n' : 'module.exports = 1\n',
		)
		dirs.push(dir)
	}

	const packages = new Map()
	for (const dir of dirs) {
		const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', tarballs], {
			cwd: dir,
			encoding: 'utf8',
			shell: process.platform === 'win32',
		})
		if (packed.status !== 0) throw new Error(`npm pack failed in ${dir}:\n${packed.stderr}`)
		// An array up to npm 11, an object keyed by package name from npm 12.
		const json = JSON.parse(packed.stdout)
		const info = Array.isArray(json) ? json[0] : Object.values(json)[0]
		const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
		const file = path.join(tarballs, info.filename)
		const data = fs.readFileSync(file)
		packages.set(manifest.name, {
			manifest,
			version: manifest.version,
			file,
			integrity: `sha512-${crypto.createHash('sha512').update(data).digest('base64')}`,
			shasum: crypto.createHash('sha1').update(data).digest('hex'),
		})
	}
	return packages
}

/** A registry holding the fixture packages, forwarding every other name to npmjs. */
function startRegistry(packages) {
	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url, 'http://127.0.0.1')
			const parts = url.pathname.split('/-/')
			const name = decodeURIComponent(parts[0].slice(1))
			const pkg = packages.get(name)

			if (pkg && parts.length > 1) {
				res.writeHead(200, { 'content-type': 'application/octet-stream' })
				fs.createReadStream(pkg.file).pipe(res)
				return
			}
			if (pkg) {
				const base = `http://${req.headers.host}`
				const tarball = `${base}/${name}/-/${path.basename(pkg.file)}`
				res.writeHead(200, { 'content-type': 'application/json' })
				res.end(
					JSON.stringify({
						name,
						'dist-tags': { latest: pkg.version },
						time: { created: OLD, modified: OLD, [pkg.version]: OLD },
						versions: {
							[pkg.version]: {
								...pkg.manifest,
								_id: `${name}@${pkg.version}`,
								dist: { tarball, integrity: pkg.integrity, shasum: pkg.shasum },
							},
						},
					}),
				)
				return
			}

			const upstream = await fetch(`https://registry.npmjs.org${url.pathname}`, {
				headers: { accept: req.headers.accept ?? 'application/json' },
			})
			res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' })
			res.end(Buffer.from(await upstream.arrayBuffer()))
		} catch (error) {
			res.writeHead(502)
			res.end(String(error))
		}
	})
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

/** Write the project. Returns the folder `findByKeywords` runs from. */
function writeProject(root, layout, fipVersion, files, registry) {
	const dependencies = { 'find-installed-packages': fipVersion }
	for (const name of DIRECT) dependencies[name] = '^1.0.0'

	let app = root
	if (layout === 'workspace') {
		writeJson(path.join(root, 'package.json'), {
			name: 'fip-probe-root',
			version: '0.0.0',
			private: true,
			workspaces: ['packages/*'],
		})
		app = path.join(root, 'packages', 'app')
		writeJson(path.join(app, 'package.json'), { name: 'fip-probe-app', version: '0.0.0', private: true, dependencies })
	} else {
		writeJson(path.join(root, 'package.json'), { name: 'fip-probe', version: '0.0.0', private: true, dependencies })
	}

	fs.writeFileSync(
		path.join(app, 'probe-run.mjs'),
		[
			"import { findByKeywords } from 'find-installed-packages'",
			`const found = await findByKeywords([${JSON.stringify(KEYWORD)}], { cwd: '.' })`,
			'const v = process.versions',
			"console.log('FIP_PROBE ' + JSON.stringify({ found, versions: { node: v.node, bun: v.bun, deno: v.deno, pnp: v.pnp } }))",
			'',
		].join('\n'),
	)

	// pnpm 12 reads the registry only from `.npmrc`, not from `npm_config_registry`.
	fs.writeFileSync(path.join(root, '.npmrc'), `registry=${registry}\n`)

	for (const [file, content] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
		fs.writeFileSync(path.join(root, file), `${content.replaceAll('\\n', '\n')}\n`)
	}
	return app
}

/** Point every manager this skill drives at the local registry, and keep its caches in `work`. */
function registryEnv(registry, work) {
	return {
		...process.env,
		npm_config_registry: registry,
		NPM_CONFIG_REGISTRY: registry,
		npm_config_cache: path.join(work, 'cache', 'npm'),
		npm_config_audit: 'false',
		npm_config_fund: 'false',
		npm_config_update_notifier: 'false',
		YARN_NPM_REGISTRY_SERVER: registry.replace(/\/$/, ''),
		YARN_UNSAFE_HTTP_WHITELIST: '127.0.0.1',
		YARN_REGISTRY: registry,
		YARN_CACHE_FOLDER: path.join(work, 'cache', 'yarn'),
		YARN_ENABLE_GLOBAL_CACHE: 'false',
		YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
		BUN_CONFIG_REGISTRY: registry,
		BUN_INSTALL_CACHE_DIR: path.join(work, 'cache', 'bun'),
		DENO_DIR: path.join(work, 'cache', 'deno'),
		// Not a CI run, whatever the parent is: some managers turn on frozen lockfiles under CI.
		CI: '',
	}
}

/** Whether the cache fingerprint (`src/getFingerprint.ts`) watches a root entry. */
function isWatched(entry) {
	const require = createRequire(path.join(pkgDir, 'package.json'))
	const { LOCKS } = require(require.resolve('package-manager-detector/constants'))
	return [...Object.keys(LOCKS), '.pnp.cjs', '.pnp.data.json', 'package.json', 'node_modules'].includes(entry)
}

function listRoot(root) {
	if (!fs.existsSync(root)) return []
	const entries = fs.readdirSync(root)
	const nm = path.join(root, 'node_modules')
	const hidden = fs.existsSync(nm)
		? fs
				.readdirSync(nm)
				.filter((name) => name.startsWith('.'))
				.map((name) => `node_modules/${name}`)
		: []
	return [...entries, ...hidden]
}

// Async on purpose: a blocking spawn would stall the registry this process serves.
async function managerVersion(install, root, env) {
	const bin = install.replace(/\s(install|i|add)\b.*$/, '')
	const out = await sh(`${bin} --version`, root, env)
	return out.code === 0 ? out.stdout.trim().split('\n')[0] : undefined
}

function parseResult(stdout) {
	const line = stdout.split('\n').find((l) => l.startsWith('FIP_PROBE '))
	return line ? JSON.parse(line.slice('FIP_PROBE '.length)) : undefined
}

function sh(command, cwd, env) {
	return new Promise((resolve) => {
		const child = spawn(command, { cwd, env, shell: true })
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (d) => {
			stdout += d
		})
		child.stderr.on('data', (d) => {
			stderr += d
		})
		child.on('close', (code) => resolve({ code, stdout, stderr }))
	})
}

function tail(text) {
	return text.trim().split('\n').slice(-15).join('\n')
}

function writeJson(file, content) {
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`)
}

function parseArgs(argv) {
	const out = { install: undefined, run: 'node', layout: 'single', files: {}, keep: false }
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--install') out.install = argv[++i]
		else if (arg === '--run') out.run = argv[++i]
		else if (arg === '--layout') out.layout = argv[++i]
		else if (arg === '--keep') out.keep = true
		else if (arg === '--file') {
			const spec = argv[++i]
			const at = spec.indexOf('=')
			out.files[spec.slice(0, at)] = spec.slice(at + 1)
		} else throw new Error(`unknown argument: ${arg}`)
	}
	if (!out.install) throw new Error('--install "<command>" is required')
	if (!['single', 'workspace'].includes(out.layout)) throw new Error('--layout is single or workspace')
	return out
}
