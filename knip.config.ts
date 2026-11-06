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
			// Run by path, never imported: the probe under each runtime being checked, the registry as a child process.
			entry: ['src/probe.mjs', 'src/registry.mjs'],
		},
	},
}

export default config
