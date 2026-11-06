import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	// Lets the Node coverage run (`test:node`) map `dist/` back to `src/`.
	sourcemap: true,
})
