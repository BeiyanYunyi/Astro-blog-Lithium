# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Astro app. Page routes live in `src/pages/`, shared layouts in `src/layouts/`, reusable UI in `src/components/`, content helpers in `src/utils/`, and site data in `src/data/` plus `src/config.ts`. Blog posts are stored as Markdown or MDX in `src/content/posts/` and validated by `src/content.config.ts`. Static files go in `public/`. Cloudflare Pages Functions and ActivityPub endpoints live under `functions/`.

## Build, Test, and Development Commands
Use `pnpm` with Node `>=25`.

- `pnpm dev`: start the Astro dev server on all interfaces with `DEV=true`.
- `pnpm start`: start the default Astro dev server.
- `pnpm build`: create a production build in `dist/`.
- `pnpm preview`: serve the built site locally.
- `pnpm page:preview`: preview the Cloudflare Pages output from `dist/`.
- `pnpm exec eslint .`: run the configured Astro, Solid, UnoCSS, and formatting checks.

## Coding Style & Naming Conventions
Formatting is defined in [eslint.config.js](/Users/beiyanyunyi/projects/Astro-blog-Lithium/eslint.config.js): 2-space indentation, semicolons, single quotes, trailing commas, and 100-character line width. Prefer TypeScript for logic and keep Astro components in `.astro`, interactive Solid components in `.tsx`, and content in `.md` or `.mdx`. Use PascalCase for components (`PostCard.astro`), camelCase for utilities (`getAllPosts.ts`), and kebab-case or slug-style names for posts and route folders.

## Testing Guidelines
There is no dedicated automated test suite yet. Before opening a PR, run `pnpm build` and `pnpm exec eslint .`, then manually verify affected pages, tag routes, RSS output, and any `functions/api/` endpoint you touched. If you add tests later, place them near the feature or under a top-level `tests/` directory and use `*.test.ts` naming.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit prefixes with gitmoji, such as `fix: 🐛 use filePath instead of id` and `docs(posts): 📝 add StopPanguing.md`. Follow that pattern and keep each commit focused. PRs should include a short description, linked issue when relevant, screenshots for visible UI changes, and notes for content, config, or Cloudflare behavior changes.

## Content & Deployment Notes
Post frontmatter must satisfy the content schema: `title`, `date`, `description`, optional `tag`, and optional `image`. When editing deployment-related code, review `astro.config.ts`, `wrangler.toml`, and `setup.sql` together so Astro output, Cloudflare bindings, and database expectations stay aligned.
