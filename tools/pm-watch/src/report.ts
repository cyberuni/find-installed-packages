/**
 * Collect the result files `check.ts` wrote and print a Markdown report.
 *
 * Usage: node src/report.ts <results-dir>
 *
 * Reads every `*.json` under `<results-dir>`, at any depth. A cell with no result file
 * is a failure too: its job died before `check.ts` could write one, e.g. the manager
 * could not be fetched. Exits 1 when any cell failed or is missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { cells } from './cells.ts'
import { type CellResult, describeFailure } from './results.ts'

const dir = process.argv[2]
if (!dir) {
	console.error('usage: report.ts <results-dir>')
	process.exit(2)
}

const results = new Map<string, CellResult>()
for (const file of listJson(dir)) {
	const result = JSON.parse(fs.readFileSync(file, 'utf8')) as CellResult
	results.set(result.cell, result)
}

const rows: string[] = []
const failures: string[] = []
for (const cell of cells) {
	const result = results.get(cell.id)
	if (!result) {
		rows.push(`| ${cell.id} | ${cell.manager} | ? | ${cell.mode} | **no result** | |`)
		failures.push(
			`### ${cell.id}: ${cell.manager} (version unknown), ${cell.mode}\n\n- No result: the job ended before the check ran. See the run log; the manager may have failed to install.`,
		)
		continue
	}
	const runtimes = [...new Set(result.checks.map((check) => check.runtime).filter(Boolean))].join(', ')
	rows.push(
		`| ${cell.id} | ${result.manager} | ${result.version ?? '?'} | ${result.mode} | ${result.ok ? 'pass' : '**fail**'} | ${runtimes} |`,
	)
	if (!result.ok) {
		const lines = [
			...(result.error ? [result.error] : []),
			...result.checks.filter((check) => !check.ok).map(describeFailure),
		]
		failures.push(
			`### ${cell.id}: ${result.manager} ${result.version ?? '(version unknown)'}, ${result.mode}\n\n${lines.map(bullet).join('\n')}`,
		)
	}
}

const server = process.env['GITHUB_SERVER_URL']
const repo = process.env['GITHUB_REPOSITORY']
const runId = process.env['GITHUB_RUN_ID']
const run = server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : undefined

const table = [
	'| Cell | Manager | Version | Mode | Result | Runtimes |',
	'| --- | --- | --- | --- | --- | --- |',
	...rows,
]

const body = [
	failures.length > 0
		? `The weekly check against each package manager's latest release found ${failures.length} failing cell(s).`
		: "Every cell passed against each package manager's latest release.",
	...(run ? [`Run: ${run}`] : []),
	table.join('\n'),
	...(failures.length > 0 ? ['## Failures', ...failures] : []),
	'Produced by `tools/pm-watch` (`.github/workflows/pm-latest-watch.yml`).',
].join('\n\n')

console.log(body)
process.exit(failures.length > 0 ? 1 : 0)

function bullet(text: string): string {
	// Multi-line errors (install output) go in a code block under the bullet.
	const [first, ...rest] = text.split('\n')
	if (rest.length === 0) return `- ${first}`
	return `- ${first}\n\n  \`\`\`\n${rest.map((line) => `  ${line}`).join('\n')}\n  \`\`\``
}

function listJson(root: string): string[] {
	return fs
		.readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
		.map((entry) => path.join(entry.parentPath, entry.name))
}
