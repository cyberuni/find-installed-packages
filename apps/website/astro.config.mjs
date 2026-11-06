// @ts-check
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
	site: 'https://cyberuni.github.io',
	base: '/find-installed-packages/',
	vite: {
		plugins: [tailwindcss()],
	},
	integrations: [
		starlight({
			title: 'find-installed-packages',
			description: 'Find the installed packages that declare a set of keywords, on every package manager layout.',
			// The cyber-* family mark: a shared command reticle around a per-package glyph
			// (see docs/design/icon-system.md in cyberuni/cyber-mux).
			//
			// The favicon self-themes: browser chrome follows the OS, so that one file
			// flips its own fill under `prefers-color-scheme` and needs no pair.
			//
			// The header logo cannot. Starlight switches on `data-theme`, which this site
			// defaults to dark independent of the OS — a single self-theming file renders
			// black on the dark header whenever the visitor's OS is set to light. So the
			// header ships as a pair and lets Starlight pick.
			favicon: '/img/logo.svg',
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				alt: 'find-installed-packages',
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/cyberuni/find-installed-packages',
				},
			],
			customCss: ['./src/styles/global.css'],
			// Declared explicitly: a page without an entry here ships unreachable.
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Keyword matching', slug: 'guides/keyword-matching' },
						{ label: 'How packages are found', slug: 'guides/how-packages-are-found' },
						{ label: 'Package managers', slug: 'package-managers' },
						{ label: 'Cache', slug: 'guides/cache' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Overview', slug: 'reference' },
						{ label: 'findByKeywords', slug: 'reference/find-by-keywords' },
					],
				},
			],
		}),
	],
})
