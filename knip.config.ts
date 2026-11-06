import type { KnipConfig } from 'knip'

const config: KnipConfig = {
	ignoreBinaries: [],
	workspaces: {
		'.': {
			// The pm-gap-scan skill runs it by path, never imports it.
			entry: ['.agents/skills/pm-gap-scan/probe.mjs'],
			// Resolved from packages/find-installed-packages, so the probe reads the same `LOCKS`.
			ignoreDependencies: ['package-manager-detector'],
		},
		'tools/pm-watch': {
			// Run by path under each runtime being checked, never imported.
			entry: ['src/probe.mjs'],
		},
	},
}

export default config
