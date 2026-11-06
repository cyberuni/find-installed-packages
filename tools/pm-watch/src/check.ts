/**
 * Install the fixture with one cell's package manager and check the built package against it.
 *
 * Usage: node src/check.ts <cell> [--out <result.json>] [--keep]
 *
 * The manager is whichever binary of that name is first on `PATH`; the caller fetches the
 * release to test. Exits 1 when any check fails, including an install that fails.
 */
import { type ChildProcess, type SpawnSyncReturns, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { type Cell, cells, findCell, type Runtime } from './cells.ts'
import { dropDependency, KEYWORD, packageFolders, type Variant, writeFixture } from './fixture.ts'
import { type CellResult, type CheckResult, describeFailure } from './results.ts'

const here = import.meta.dirname
const probe = path.join(here, 'probe.mjs')
const registryScript = path.join(here, 'registry.mjs')
const subjectDir = path.resolve(here, '../../../packages/find-installed-packages')
const dist = path.join(subjectDir, 'dist/index.mjs')
const subject = JSON.parse(fs.readFileSync(path.join(subjectDir, 'package.json'), 'utf8')) as { version: string }
const subjectInfo = { version: subject.version, dir: subjectDir }

const INSTALL_TIMEOUT = 5 * 60_000
const PROBE_TIMEOUT = 60_000

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { out: { type: 'string' }, keep: { type: 'boolean', default: false } },
})

const cell = findCell(positionals[0] ?? '')
if (!cell) {
	console.error(`usage: check.ts <cell> [--out file] [--keep]\ncells: ${cells.map((c) => c.id).join(', ')}`)
	process.exit(2)
}

const result = await run(cell)
const json = `${JSON.stringify(result, null, '\t')}\n`
if (values.out) fs.writeFileSync(values.out, json)
else process.stdout.write(json)
printSummary(result)
process.exit(result.ok ? 0 : 1)

async function run(cell: Cell): Promise<CellResult> {
	const result: CellResult = {
		cell: cell.id,
		manager: cell.manager,
		mode: cell.mode,
		version: null,
		ok: false,
		checks: [],
	}

	if (!fs.existsSync(dist)) {
		result.error = `${dist} does not exist; build the package first (bun run build)`
		return result
	}

	const version = exec(cell.manager, ['--version'], process.cwd())
	if (version.error || version.status !== 0) {
		result.error = `\`${cell.manager} --version\` failed: ${version.error?.message ?? tail(version)}`
		return result
	}
	// Most managers print only the version. Deno prints `deno 2.9.8 (stable, ...)` and more lines after it.
	result.version = version.stdout.match(/\d+\.\d+\.\d+\S*/)?.[0] ?? null
	const major = Number(result.version?.split('.')[0])
	if (cell.majors && !(major >= cell.majors.min && major <= (cell.majors.max ?? Number.POSITIVE_INFINITY))) {
		result.error = `${cell.manager} ${result.version} on PATH is not the release line this cell tests`
		return result
	}

	const root = fs.mkdtempSync(path.join(os.tmpdir(), `fip-pm-watch-${cell.id}-`))
	let registry: { url: string; child: ChildProcess } | undefined
	try {
		const variants = writeFixture(root, cell, subjectInfo)
		const env: Record<string, string> = { ...cell.env }
		if (cell.registry) {
			registry = await startRegistry([...packageFolders(root), subjectDir])
			// Deno keeps its cache in `DENO_DIR`. Inside the fixture, it starts empty and is removed with it.
			Object.assign(env, {
				NPM_CONFIG_REGISTRY: registry.url,
				npm_config_registry: registry.url,
				DENO_DIR: path.join(root, 'deno-dir'),
			})
		}
		for (const variant of variants) {
			result.checks.push(...checkVariant(cell, variant, root, env))
		}
	} catch (error) {
		result.error = error instanceof Error ? error.message : String(error)
	} finally {
		registry?.child.kill()
		if (values.keep) console.error(`fixture kept at ${root}`)
		else fs.rmSync(root, { recursive: true, force: true })
	}

	result.ok = result.checks.length > 0 && result.checks.every((check) => check.ok)
	return result
}

function checkVariant(cell: Cell, variant: Variant, root: string, env: Record<string, string>): CheckResult[] {
	const checks: CheckResult[] = []
	const v = variant.name

	if (installsSubject(cell)) fs.copyFileSync(probe, path.join(variant.cwd, 'pm-watch-probe.mjs'))
	const installed = install(cell, variant, env)
	checks.push({ variant: v, step: 'install', ...installed })
	if (!installed.ok) return checks

	const layout = checkLayout(cell, variant)
	checks.push({ variant: v, step: 'layout', ok: !layout, ...(layout ? { error: layout } : {}) })

	// Each runtime gets its own temp dir, so its cache file is its own: the `cached` probe
	// reads what that runtime wrote, and the `reinstall` probe proves that entry goes stale.
	const tmpdirs = new Map<Runtime, string>()
	for (const runtime of cell.runtimes) {
		const tmpdir = path.join(root, `tmp-${runtime}`)
		fs.mkdirSync(tmpdir, { recursive: true })
		tmpdirs.set(runtime, tmpdir)
		for (const step of ['first', 'cached']) {
			checks.push({ variant: v, step, ...probeRuntime(cell, runtime, variant, tmpdir, variant.expected, env) })
		}
	}

	const expected = dropDependency(variant)
	const reinstalled = install(cell, variant, env)
	if (!reinstalled.ok) {
		checks.push({ variant: v, step: 'reinstall', ...reinstalled })
		return checks
	}
	for (const [runtime, tmpdir] of tmpdirs) {
		checks.push({ variant: v, step: 'reinstall', ...probeRuntime(cell, runtime, variant, tmpdir, expected, env) })
	}
	return checks
}

function install(cell: Cell, variant: Variant, env: Record<string, string>): { ok: boolean; error?: string } {
	const out = exec(cell.manager, cell.install, variant.installRoot, env, INSTALL_TIMEOUT)
	if (out.error)
		return { ok: false, error: `\`${cell.manager} ${cell.install.join(' ')}\` failed: ${out.error.message}` }
	if (out.status !== 0) {
		return { ok: false, error: `\`${cell.manager} ${cell.install.join(' ')}\` exited ${out.status}: ${tail(out)}` }
	}
	return { ok: true }
}

/**
 * Check the install has the layout the cell is meant to test. Returns why not, if not.
 * A manager that changes its layout makes the cell test something else, which is a finding too.
 */
function checkLayout(cell: Cell, variant: Variant): string | undefined {
	// In a workspace the tree may sit next to the project or at the workspace root.
	const top = (name: string) =>
		[variant.cwd, variant.installRoot].map((dir) => path.join(dir, 'node_modules', name)).find((p) => fs.existsSync(p))
	const a = top('plugin-a')
	const b = top('plugin-b')

	if (cell.layout === 'global-cache') {
		const found = [variant.cwd, variant.installRoot].find((dir) => fs.existsSync(path.join(dir, 'node_modules')))
		return found ? `expected no node_modules, but ${found} has one` : undefined
	}

	if (cell.layout === 'pnp') {
		if (fs.existsSync(path.join(variant.installRoot, 'node_modules'))) return 'expected no node_modules under PnP'
		return fs.existsSync(path.join(variant.installRoot, '.pnp.cjs'))
			? undefined
			: 'expected .pnp.cjs at the install root'
	}

	if (!a) return 'expected plugin-a in a node_modules folder'
	const linked = fs.lstatSync(a).isSymbolicLink()
	if (cell.layout === 'isolated') {
		if (!linked) return 'expected plugin-a linked from a store, but it is a plain folder'
		return b ? 'expected the transitive plugin-b only in the store, but it is hoisted' : undefined
	}

	// `tree`: plain folders, with the transitive dependency hoisted or nested under its dependent.
	if (linked) return 'expected plugin-a as a plain folder in node_modules, but it is a symlink'
	if (!b && !fs.existsSync(path.join(a, 'node_modules', 'plugin-b'))) {
		return 'expected plugin-b in the node_modules tree, hoisted or under plugin-a'
	}
	return undefined
}

function installsSubject(cell: Cell): boolean {
	return Boolean(cell.registry || cell.installSubject)
}

/**
 * What follows the runtime on the command line. A cell that installs the package imports the package by name
 * from a probe copied into the project, so the runtime resolves it the way a consumer's does.
 * Other cells import the build by path.
 */
function probeArgs(cell: Cell, variant: Variant): string[] {
	return installsSubject(cell)
		? [path.join(variant.cwd, 'pm-watch-probe.mjs'), 'find-installed-packages', variant.cwd, KEYWORD]
		: [probe, dist, variant.cwd, KEYWORD]
}

function probeRuntime(
	cell: Cell,
	runtime: Runtime,
	variant: Variant,
	tmpdir: string,
	expected: string[],
	cellEnv: Record<string, string>,
): Omit<CheckResult, 'variant' | 'step'> {
	const [command, ...prefix] =
		runtime === 'yarn-node' ? ['yarn', 'node'] : runtime === 'deno' ? ['deno', 'run', '-A'] : [runtime]
	const env = { ...cellEnv, TMPDIR: tmpdir, TEMP: tmpdir, TMP: tmpdir }
	const out = exec(command as string, [...prefix, ...probeArgs(cell, variant)], variant.installRoot, env, PROBE_TIMEOUT)
	if (out.error || out.status !== 0) {
		return { runtime, ok: false, expected, error: `probe failed: ${out.error?.message ?? tail(out)}` }
	}

	let parsed: { packages: string[]; runtime: string; pnp: boolean }
	try {
		const line = out.stdout.trim().split('\n').pop() ?? ''
		parsed = JSON.parse(line)
	} catch {
		return { runtime, ok: false, expected, error: `probe printed no result: ${tail(out)}` }
	}

	if (runtime === 'yarn-node' && !parsed.pnp) {
		return { runtime: parsed.runtime, ok: false, expected, error: '`yarn node` did not load the PnP runtime' }
	}

	const actual = [...parsed.packages].sort()
	const ok = actual.length === expected.length && actual.every((name, i) => name === expected[i])
	return { runtime: parsed.runtime, ok, expected, actual }
}

/** Start `registry.mjs` on a free port and wait for it to print its URL. */
function startRegistry(folders: string[]): Promise<{ url: string; child: ChildProcess }> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [registryScript, ...folders], { env: childEnv({}) })
		let stdout = ''
		let stderr = ''
		const timer = setTimeout(() => {
			child.kill()
			reject(new Error(`the local registry did not start in 60s: ${stderr.trim()}`))
		}, 60_000)
		child.stderr.on('data', (data) => {
			stderr += data
		})
		child.stdout.on('data', (data) => {
			stdout += data
			const url = stdout.split('\n')[0]
			if (stdout.includes('\n') && url) {
				clearTimeout(timer)
				resolve({ url, child })
			}
		})
		child.on('exit', (code) => {
			clearTimeout(timer)
			reject(new Error(`the local registry exited ${code}: ${stderr.trim()}`))
		})
	})
}

function exec(
	command: string,
	args: string[],
	cwd: string,
	extraEnv: Record<string, string> = {},
	timeout = 30_000,
): SpawnSyncReturns<string> {
	return spawnSync(command, args, { cwd, env: childEnv(extraEnv), encoding: 'utf8', timeout })
}

/**
 * The environment for a manager or probe. Drops the `npm_*` variables a parent
 * `npm run` / `bun run` sets, since managers read them as their own config and
 * user agent.
 */
function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {}
	for (const [key, value] of Object.entries(process.env)) {
		if (!key.toLowerCase().startsWith('npm_')) env[key] = value
	}
	return { ...env, ...extra }
}

function tail(out: SpawnSyncReturns<string>): string {
	const text = `${out.stderr ?? ''}\n${out.stdout ?? ''}`.trim()
	const lines = text.split('\n').slice(-15).join('\n')
	return lines || `(no output, signal ${out.signal ?? 'none'})`
}

function printSummary(result: CellResult) {
	const head = `${result.ok ? 'PASS' : 'FAIL'} ${result.cell}: ${result.manager} ${result.version ?? '(not found)'}, ${result.mode}`
	const lines = [head]
	if (result.error) lines.push(`  ${result.error}`)
	for (const check of result.checks) {
		if (!check.ok) lines.push(`  ${describeFailure(check)}`)
	}
	const runtimes = [...new Set(result.checks.map((c) => c.runtime).filter(Boolean))]
	if (runtimes.length > 0) lines.push(`  runtimes: ${runtimes.join(', ')}`)
	console.error(lines.join('\n'))

	const summary = process.env['GITHUB_STEP_SUMMARY']
	if (summary) {
		fs.appendFileSync(summary, `\`\`\`\n${lines.join('\n')}\n\`\`\`\n`)
	}
}
