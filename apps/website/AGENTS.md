# apps/website

The documentation site: Astro + Starlight, deployed to GitHub Pages at
<https://cyberuni.github.io/find-installed-packages/> by
`.github/workflows/deploy-pages.yml` on every push to `main`. The package is
private and takes no changeset.

## Commands

Run from the repository root:

| Command | What it does |
| --- | --- |
| `bun run web dev` | Start the dev server |
| `bun run web build` | Build to `apps/website/dist` |
| `bun run web preview` | Serve the built site |
| `bun run web typecheck` | `astro check` |

`bun run verify` builds and type-checks the site along with the library.

## Rules

- **Internal links carry the base path.** Starlight does not rewrite links in
  content. Write `/find-installed-packages/guides/cache/`, not `/guides/cache/`.
  A missing prefix builds cleanly and 404s in production. Sidebar entries are
  the exception: they take bare slugs.
- **The sidebar is explicit.** It is declared in `astro.config.mjs`. A new page
  without an entry there ships unreachable.
- **Document only what the package backs up.** Take behavior from the specs
  (`packages/find-installed-packages/src/*.spec.ts`) and the source, not from
  memory or from other docs. Update the pages when that behavior changes.
- **Keep the toolchain pinned as a set.** Astro, Starlight, Tailwind and
  `@astrojs/check` move together. `typescript` stays on 6.x here because `astro
  check` needs the TypeScript JS API.
- **The logo is the cyber-* icon system.** The two frame paths are shared across
  the family; only the glyph is this package's. `public/img/logo.svg`
  self-themes for the favicon, and the `src/assets/logo-{light,dark}.svg` pair
  serves the header. Change all three together.
