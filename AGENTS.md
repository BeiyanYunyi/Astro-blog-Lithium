# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Astro app. Page routes live in `src/pages/`, shared layouts in `src/layouts/`, reusable UI in `src/components/`, content helpers in `src/utils/`, and site data in `src/data/` plus `src/config.ts`. Blog posts are stored as Markdown or MDX in `src/content/posts/` and validated by `src/content.config.ts`. Static files go in `public/`. The Cloudflare Worker entrypoint is `src/server/worker.ts`; it delegates HTTP to the Astro adapter and handles scheduled publication scans and queue consumption. ActivityPub endpoints live in `src/pages/api/`, WebFinger in `src/pages/.well-known/`, and Fedify dispatchers and storage adapters in `src/server/activitypub/`. Database migrations live in `migrations/`.

## Build, Test, and Development Commands
Use `pnpm` with Node `>=26`.

- `pnpm dev`: start the Astro Cloudflare dev runtime on all interfaces with `DEV=true`.
- `pnpm start`: start the default Astro dev server.
- `pnpm build`: create a production build in `dist/`.
- `pnpm preview`: serve the built site locally.
- `pnpm worker:dev`: start the Astro Cloudflare dev runtime.
- `pnpm worker:check`: type-check the Worker.
- `pnpm test:worker`: run the built Astro Worker regression tests in Miniflare (run `pnpm build` first).
- `pnpm deploy`: build and deploy the Worker and static assets.
- `pnpm check`: run Biome formatting, recommended lint rules, and recommended assist checks without modifying files.
- `pnpm lint`: run Biome recommended lint rules without modifying files.
- `pnpm format`: apply Biome default formatting.

## Coding Style & Naming Conventions
Use Biome default formatting and the recommended linter and assist rules configured in `biome.json`. Prefer TypeScript for logic and keep Astro components in `.astro`, interactive Solid components in `.tsx`, and content in `.md` or `.mdx`. Use PascalCase for components (`PostCard.astro`), camelCase for utilities (`getAllPosts.ts`), and kebab-case or slug-style names for posts and route folders.

## Testing Guidelines
Worker regression tests live in `tests/worker.test.ts`. Run `pnpm worker:check` and `pnpm test:worker` for server changes. Before opening a PR, run `pnpm build` and `pnpm check`, then manually verify affected pages, tag routes, RSS output, and any `src/pages/api/` endpoint you touched. If you add tests later, place them near the feature or under a top-level `tests/` directory and use `*.test.ts` naming.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit prefixes with gitmoji, such as `fix: 🐛 use filePath instead of id` and `docs(posts): 📝 add StopPanguing.md`. Follow that pattern and keep each commit focused. PRs should include a short description, linked issue when relevant, screenshots for visible UI changes, and notes for content, config, or Cloudflare behavior changes.

## Content & Deployment Notes
Post frontmatter must satisfy the content schema: `title`, `date`, `description`, optional `tag`, and optional `image`. When editing deployment-related code, review `astro.config.ts`, `wrangler.jsonc`, and `setup.sql` together so Astro output, Cloudflare bindings, and database expectations stay aligned.
