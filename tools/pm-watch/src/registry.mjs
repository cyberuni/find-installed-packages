// A throwaway npm registry for the cells whose manager will not install `file:` dependencies.
// Serves each package folder named on the command line, packed with `npm pack`, and
// forwards every other name to registry.npmjs.org (the dependencies of the package under
// test). Prints the registry URL on the first line of output. Runs until killed.
//
// Usage: node registry.mjs <package folder>...
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const dirs = process.argv.slice(2)
if (dirs.length === 0) {
	console.error('usage: registry.mjs <package folder>...')
	process.exit(2)
}

const tarballs = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-pm-watch-tarballs-'))
const packages = new Map()
for (const dir of dirs) {
	const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', tarballs], { cwd: dir, encoding: 'utf8' })
	if (packed.status !== 0) {
		console.error(`npm pack failed in ${dir}:\n${packed.stderr}`)
		process.exit(1)
	}
	// An array up to npm 11, an object keyed by package name from npm 12.
	const json = JSON.parse(packed.stdout)
	const info = Array.isArray(json) ? json[0] : Object.values(json)[0]
	const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
	const file = path.join(tarballs, info.filename)
	const data = fs.readFileSync(file)
	packages.set(manifest.name, {
		manifest,
		file,
		integrity: `sha512-${crypto.createHash('sha512').update(data).digest('base64')}`,
		shasum: crypto.createHash('sha1').update(data).digest('hex'),
	})
}

// `/name`, `/@scope/name`, or the tarball `/name/-/name-1.2.3.tgz` under either.
const UPSTREAM_PATH = /^\/((?:@[\w.~-]+(?:\/|%2f))?[\w.~-]+(?:\/-\/[\w.~+-]+\.tgz)?)$/i
const OLD = '2020-01-01T00:00:00.000Z'
const server = http.createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://127.0.0.1')
	const parts = url.pathname.split('/-/')
	const name = decodeURIComponent((parts[0] ?? '').slice(1))
	const pkg = packages.get(name)
	if (!pkg) {
		// Forward only the metadata and tarball paths an install asks for, never an arbitrary path.
		const match = UPSTREAM_PATH.exec(url.pathname)
		if (!match) {
			res.writeHead(404)
			res.end('not found')
			return
		}
		try {
			const upstream = await fetch(`https://registry.npmjs.org/${match[1]}`, {
				headers: { accept: req.headers.accept ?? 'application/json' },
			})
			res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' })
			res.end(Buffer.from(await upstream.arrayBuffer()))
		} catch {
			res.writeHead(502)
			res.end('upstream registry unavailable')
		}
		return
	}
	if (parts.length > 1) {
		res.writeHead(200, { 'content-type': 'application/octet-stream' })
		fs.createReadStream(pkg.file).pipe(res)
		return
	}
	const { version } = pkg.manifest
	const tarball = `http://${req.headers.host}/${name}/-/${path.basename(pkg.file)}`
	res.writeHead(200, { 'content-type': 'application/json' })
	res.end(
		JSON.stringify({
			name,
			'dist-tags': { latest: version },
			time: { created: OLD, modified: OLD, [version]: OLD },
			versions: {
				[version]: {
					...pkg.manifest,
					_id: `${name}@${version}`,
					dist: { tarball, integrity: pkg.integrity, shasum: pkg.shasum },
				},
			},
		}),
	)
})
server.listen(0, '127.0.0.1', () => {
	const address = server.address()
	console.log(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/`)
})
