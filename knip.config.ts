import type { KnipConfig } from 'knip'

const config: KnipConfig = {
	ignoreBinaries: [],
	workspaces: {
		'tools/pm-watch': {
			// Run by path under each runtime being checked, never imported.
			entry: ['src/probe.mjs'],
		},
	},
}

export default config
