import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { INSTALL_METADATA } from 'package-manager-detector/constants'
import { getFingerprint } from './getFingerprint'

const created: string[] = []

afterEach(() => {
	while (created.length) fs.rmSync(created.pop() as string, { recursive: true, force: true })
})

/** A name ending in `/` makes a folder; any other name makes a file. */
function makeProject(files: Record<string, string>) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fip-fingerprint-'))
	created.push(root)
	for (const name of Object.keys(files)) {
		const filepath = path.join(root, name)
		if (name.endsWith('/')) {
			fs.mkdirSync(filepath, { recursive: true })
			continue
		}
		fs.mkdirSync(path.dirname(filepath), { recursive: true })
		fs.writeFileSync(filepath, files[name] as string)
	}
	return root
}

/** Set an mtime far enough ahead that the change is unambiguous. */
function touch(filepath: string, msFromNow: number) {
	const when = new Date(fs.statSync(filepath).mtimeMs + msFromNow)
	fs.utimesSync(filepath, when, when)
}

describe('lockfiles', () => {
	// The lockfile names come from package-manager-detector, so managers we never
	// hand-listed are covered. `nub` was one of them.
	for (const lockfile of ['nub.lock', 'bun.lock', 'pnpm-lock.yaml', 'deno.lock', 'aube-lock.yaml']) {
		test(`${lockfile} is part of the stamp`, async () => {
			const root = makeProject({ 'package.json': '{}', [lockfile]: '' })

			const before = await getFingerprint(root)
			touch(path.join(root, lockfile), 10_000)
			const after = await getFingerprint(root)

			expect(after).toBeGreaterThan(before)
		})
	}

	test('yarn pnp files count even though they are not lockfiles', async () => {
		const root = makeProject({ 'package.json': '{}', '.pnp.cjs': '' })

		const before = await getFingerprint(root)
		touch(path.join(root, '.pnp.cjs'), 10_000)

		expect(await getFingerprint(root)).toBeGreaterThan(before)
	})
})

describe('install markers', () => {
	// The markers come from package-manager-detector's INSTALL_METADATA, so an
	// install that rewrites the tree but not the lockfile is noticed.
	for (const marker of Object.keys(INSTALL_METADATA)) {
		test(`${marker} is part of the stamp`, async () => {
			const root = makeProject({ 'package.json': '{}', 'pnpm-lock.yaml': '', [marker]: '' })

			const before = await getFingerprint(root)
			touch(path.join(root, marker), 10_000)

			expect(await getFingerprint(root)).toBeGreaterThan(before)
		})
	}

	test("a workspace member sees the root's store change", async () => {
		const root = makeProject({
			'package.json': '{}',
			'pnpm-lock.yaml': '',
			'node_modules/.pnpm/': '',
			'packages/a/package.json': '{}',
			'packages/a/node_modules/': '',
		})
		const project = path.join(root, 'packages', 'a')

		const before = await getFingerprint(project)
		touch(path.join(root, 'node_modules', '.pnpm'), 10_000)

		expect(await getFingerprint(project)).toBeGreaterThan(before)
	})

	test('a marker does not stop the walk before the lockfile', async () => {
		const root = makeProject({
			'package.json': '{}',
			'yarn.lock': '',
			'packages/a/package.json': '{}',
			'packages/a/node_modules/.yarn-state.yml': '',
		})
		const project = path.join(root, 'packages', 'a')

		const before = await getFingerprint(project)
		touch(path.join(root, 'yarn.lock'), 10_000)

		expect(await getFingerprint(project)).toBeGreaterThan(before)
	})
})

describe('lookup', () => {
	test('finds the lockfile at the workspace root, above cwd', async () => {
		const root = makeProject({
			'package.json': '{}',
			'pnpm-lock.yaml': '',
			'packages/a/package.json': '{}',
		})
		const project = path.join(root, 'packages', 'a')

		const before = await getFingerprint(project)
		touch(path.join(root, 'pnpm-lock.yaml'), 10_000)

		expect(await getFingerprint(project)).toBeGreaterThan(before)
	})

	test('falls back to the manifest when no lockfile exists anywhere', async () => {
		const root = makeProject({ 'package.json': '{}' })

		const fingerprint = await getFingerprint(root)

		expect(fingerprint).toBeGreaterThan(0)
		expect(fingerprint).toBe(fs.statSync(path.join(root, 'package.json')).mtimeMs)
	})

	test('a cwd that does not exist still stamps from the lockfile above it', async () => {
		const root = makeProject({ 'package.json': '{}', 'yarn.lock': '' })

		const fingerprint = await getFingerprint(path.join(root, 'no', 'such', 'folder'))

		expect(fingerprint).toBe(fs.statSync(path.join(root, 'yarn.lock')).mtimeMs)
	})
})
