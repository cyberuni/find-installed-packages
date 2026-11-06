import { createRequire } from 'node:module'

/** The part of Yarn's `pnpapi` this package uses. */
export type PnpApi = {
	/**
	 * The folder of package `request` as seen from file `issuer`, ignoring `exports`.
	 * Throws when `issuer` does not declare it. `null` for built-in modules.
	 */
	resolveToUnqualified(request: string, issuer: string): string | null
}

/**
 * The Yarn PnP API of the running process, or `undefined` when it is not running under PnP.
 *
 * Yarn serves `pnpapi` only to processes it starts with its PnP runtime, so this adds
 * no dependency and does nothing on `node_modules` installs.
 */
export function getPnpApi(): PnpApi | undefined {
	if (!process.versions['pnp']) return undefined
	try {
		return createRequire(import.meta.url)('pnpapi')
	} catch {
		return undefined
	}
}
