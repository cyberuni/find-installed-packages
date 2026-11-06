/** A package manager the watch installs with. Its binary is looked up on `PATH`. */
type Manager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'deno'

/**
 * How the built package is run against the installed fixture.
 * `yarn-node` is Node started by `yarn node`, so Yarn's PnP runtime is loaded.
 */
export type Runtime = 'node' | 'bun' | 'deno' | 'yarn-node'

/** One matrix cell: a package manager in one install mode. */
export type Cell = {
	id: string
	manager: Manager
	/** Human-readable mode, used in reports. */
	mode: string
	/**
	 * The major version range the binary on `PATH` must be in.
	 * Guards against running the Yarn classic cell with Yarn berry, or the other way round.
	 */
	majors?: { min: number; max?: number }
	/** Arguments to the manager for an install that may write a fresh lockfile. */
	install: string[]
	/** Extra files written at the install root, keyed by name. */
	files?: Record<string, string>
	/** Extra environment for the install. */
	env?: Record<string, string>
	/**
	 * The `workspace:` protocol or a plain range, for depending on a sibling workspace.
	 * `null` leaves the sibling out, for a mode where it cannot be resolved at all.
	 */
	workspaceRange: string | null
	/** The manager reads workspaces from `pnpm-workspace.yaml` rather than `package.json`. */
	pnpmWorkspace?: boolean
	runtimes: Runtime[]
	/**
	 * Install from a throwaway local registry instead of `file:` folders. For a manager that
	 * does not install `file:` dependencies (Deno skips them without an error).
	 */
	registry?: boolean
	/**
	 * Install this package into the fixture project and run the probe from inside it, as a
	 * consumer does. Implied by `registry`. Needed under PnP: Yarn serves `pnpapi` only to
	 * files inside the project, so a build loaded from outside it cannot ask the PnP API.
	 */
	installSubject?: boolean
	/**
	 * What the install must have laid out for this cell to test its mode at all:
	 * `tree` is plain package folders in `node_modules` (hoisted or nested), `isolated`
	 * is symlinks into a store, `pnp` is no `node_modules` at all, and `global-cache` is no
	 * `node_modules` either, with the packages served from the manager's own cache folder.
	 */
	layout: 'tree' | 'isolated' | 'pnp' | 'global-cache'
}

// Yarn berry turns on immutable installs on CI, which refuses to write the fresh lockfile.
const berryEnv = { YARN_ENABLE_IMMUTABLE_INSTALLS: 'false', YARN_ENABLE_TELEMETRY: '0' }

export const cells: Cell[] = [
	{
		id: 'npm',
		manager: 'npm',
		mode: 'default (hoisted)',
		// `--install-links` packs each `file:` folder and installs it as from a registry.
		// Without it npm symlinks the folder and never installs that package's own
		// dependencies, so the transitive dependency is missing from disk altogether.
		install: ['install', '--install-links', '--no-audit', '--no-fund'],
		workspaceRange: '*',
		runtimes: ['node'],
		layout: 'tree',
	},
	{
		id: 'pnpm',
		manager: 'pnpm',
		mode: 'default (isolated)',
		// pnpm turns on `--frozen-lockfile` on CI, which refuses to write the fresh lockfile.
		install: ['install', '--no-frozen-lockfile'],
		workspaceRange: 'workspace:*',
		pnpmWorkspace: true,
		runtimes: ['node'],
		layout: 'isolated',
	},
	{
		id: 'yarn-classic',
		manager: 'yarn',
		mode: 'classic',
		majors: { min: 1, max: 1 },
		install: ['install', '--non-interactive', '--no-progress'],
		workspaceRange: '*',
		runtimes: ['node'],
		layout: 'tree',
	},
	{
		id: 'yarn-berry-node-modules',
		manager: 'yarn',
		mode: 'berry, nodeLinker: node-modules',
		majors: { min: 2 },
		install: ['install'],
		files: { '.yarnrc.yml': 'nodeLinker: node-modules\n', 'yarn.lock': '' },
		env: berryEnv,
		workspaceRange: 'workspace:*',
		runtimes: ['node'],
		layout: 'tree',
	},
	{
		id: 'yarn-berry-pnp',
		manager: 'yarn',
		mode: 'berry, nodeLinker: pnp',
		majors: { min: 2 },
		install: ['install'],
		files: { '.yarnrc.yml': 'nodeLinker: pnp\n', 'yarn.lock': '' },
		installSubject: true,
		env: berryEnv,
		workspaceRange: 'workspace:*',
		runtimes: ['yarn-node'],
		layout: 'pnp',
	},
	{
		id: 'bun-hoisted',
		manager: 'bun',
		mode: '--linker=hoisted',
		install: ['install', '--linker=hoisted'],
		workspaceRange: 'workspace:*',
		runtimes: ['node', 'bun'],
		layout: 'tree',
	},
	{
		id: 'bun-isolated',
		manager: 'bun',
		mode: '--linker=isolated',
		install: ['install', '--linker=isolated'],
		workspaceRange: 'workspace:*',
		runtimes: ['node', 'bun'],
		layout: 'isolated',
	},
	{
		id: 'deno-none',
		manager: 'deno',
		mode: 'nodeModulesDir: none',
		install: ['install'],
		files: { 'deno.json': '{ "nodeModulesDir": "none" }\n' },
		registry: true,
		// With no `node_modules`, `require.resolve` cannot reach a workspace sibling: it is
		// neither in `node_modules` nor in Deno's cache. Known, and not what this cell checks.
		workspaceRange: null,
		// Node cannot see packages that live in Deno's cache, so only Deno runs this cell.
		runtimes: ['deno'],
		layout: 'global-cache',
	},
	{
		id: 'deno-auto',
		manager: 'deno',
		mode: 'nodeModulesDir: auto',
		install: ['install'],
		files: { 'deno.json': '{ "nodeModulesDir": "auto" }\n' },
		registry: true,
		workspaceRange: 'workspace:*',
		runtimes: ['node', 'deno'],
		layout: 'isolated',
	},
]

export function findCell(id: string): Cell | undefined {
	return cells.find((cell) => cell.id === id)
}
