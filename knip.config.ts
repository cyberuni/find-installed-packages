import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: ['wallaby.js'],
  ignoreDependencies: [
    '@semantic-release/github', // referenced in .releaserc.json
    '@semantic-release/npm',    // referenced in .releaserc.json
  ],
  ignoreBinaries: [
    'codacy-coverage', // used in the codacy script, installed externally
  ],
}

export default config
