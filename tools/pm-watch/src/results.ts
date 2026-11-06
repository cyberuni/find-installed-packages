/** One step of one fixture variant. */
export type CheckResult = {
	variant: string
	/** `install`, `layout`, or a probe: `first`, `cached`, `reinstall`. */
	step: string
	runtime?: string
	ok: boolean
	expected?: string[]
	actual?: string[]
	error?: string
}

/** Everything `check.ts` learned about one cell. */
export type CellResult = {
	cell: string
	manager: string
	mode: string
	/** The manager version that ran, or `null` when it could not be found. */
	version: string | null
	ok: boolean
	/** Set when the cell could not run at all, e.g. the manager is missing. */
	error?: string
	checks: CheckResult[]
}

/** Describe how `actual` differs from `expected`, e.g. `missing plugin-d; unexpected plugin-c`. */
function describeDiff(expected: string[], actual: string[]): string {
	const missing = expected.filter((name) => !actual.includes(name))
	const unexpected = actual.filter((name) => !expected.includes(name))
	const parts: string[] = []
	if (missing.length > 0) parts.push(`missing ${missing.join(', ')}`)
	if (unexpected.length > 0) parts.push(`unexpected ${unexpected.join(', ')}`)
	if (parts.length === 0 && expected.length !== actual.length) parts.push('duplicates reported')
	return parts.join('; ')
}

/** A one-line account of a failed check, for logs and the issue body. */
export function describeFailure(check: CheckResult): string {
	const where = [check.variant, check.step, check.runtime].filter(Boolean).join(' / ')
	if (check.error) return `${where}: ${check.error}`
	const diff = describeDiff(check.expected ?? [], check.actual ?? [])
	return `${where}: expected [${(check.expected ?? []).join(', ')}], got [${(check.actual ?? []).join(', ')}] (${diff})`
}
