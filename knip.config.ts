import type { KnipConfig } from 'knip'

const config: KnipConfig = {
	ignoreBinaries: [
		'codacy-coverage', // used in the codacy script, installed externally
	],
}

export default config
