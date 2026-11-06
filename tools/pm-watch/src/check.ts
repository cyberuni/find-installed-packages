/**
 * Install the fixture with one cell's package manager and check the built package against it.
 *
 * Usage: node src/check.ts <cell> [--out <result.json>] [--keep]
 *
 * The manager is whichever binary of that name is first on `PATH`; the caller fetches the
 * release to test. Exits 1 when any check fails, including an install that fails.
 */
import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { type Cell, cells, findCell, type Runtime } from './cells.ts'
import { dropDependency, KEYWORD, type Variant, writeFixture } from './fixture.ts'
import { type CellResult, type CheckResult, describeFailure } from './results.ts'

const here = import.meta.dirname
const probe = path.join(here, 'probe.mjs')
const dist = path.resolve(here, '../../../packages/find-installed-packages/dist/index.mjs')

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

const result = run(cell)
const json = `${JSON.stringify(result, null, '\t')}\n`
if (values.out) fs.writeFileSync(values.out, json)
else process.stdout.write(json)
printSummary(result)
process.exit(result.ok ? 0 : 1)

function run(cell: Cell): CellResult {
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
	result.version = version.stdout.trim().split('\n').pop()?.trim() ?? null
	const major = Number(result.version?.split('.')[0])
	if (cell.majors && !(major >= cell.majors.min && major <= (cell.majors.max ?? Number.POSITIVE_INFINITY))) {
		result.error = `${cell.manager} ${result.version} on PATH is not the release line this cell tests`
		return result
	}

	const root = fs.mkdtempSync(path.join(os.tmpdir(), `fip-pm-watch-${cell.id}-`))
	try {
		for (const variant of writeFixture(root, cell)) {
			result.checks.push(...checkVariant(cell, variant, root))
		}
	} finally {
		if (values.keep) console.error(`fixture kept at ${root}`)
		else fs.rmSync(root, { recursive: true, force: true })
	}

	result.ok = result.checks.length > 0 && result.checks.every((check) => check.ok)
	return result
}

function checkVariant(cell: Cell, variant: Variant, root: string): CheckResult[] {
	const checks: CheckResult[] = []
	const v = variant.name

	const installed = install(cell, variant)
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
			checks.push({ variant: v, step, ...probeRuntime(runtime, variant, tmpdir, variant.expected) })
		}
	}

	const expected = dropDependency(variant)
	const reinstalled = install(cell, variant)
	if (!reinstalled.ok) {
		checks.push({ variant: v, step: 'reinstall', ...reinstalled })
		return checks
	}
	for (const [runtime, tmpdir] of tmpdirs) {
		checks.push({ variant: v, step: 'reinstall', ...probeRuntime(runtime, variant, tmpdir, expected) })
	}
	return checks
}

function install(cell: Cell, variant: Variant): { ok: boolean; error?: string } {
	const out = exec(cell.manager, cell.install, variant.installRoot, cell.env, INSTALL_TIMEOUT)
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

function probeRuntime(
	runtime: Runtime,
	variant: Variant,
	tmpdir: string,
	expected: string[],
): Omit<CheckResult, 'variant' | 'step'> {
	const [command, ...prefix] = runtime === 'yarn-node' ? ['yarn', 'node'] : [runtime]
	const env = { TMPDIR: tmpdir, TEMP: tmpdir, TMP: tmpdir }
	const out = exec(
		command as string,
		[...prefix, probe, dist, variant.cwd, KEYWORD],
		variant.installRoot,
		env,
		PROBE_TIMEOUT,
	)
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
