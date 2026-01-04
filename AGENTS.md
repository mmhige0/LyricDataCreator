# Repository Guidelines

## Project Structure & Module Organization
- Next.js 14 App Router lives in `app/` (`layout.tsx`, `page.tsx`) with global styles in `app/globals.css`.
- Reusable view logic sits in `components/` (shared UI in `components/ui/`), custom hooks in `hooks/`, helpers in `lib/`, and shared types in `types/`.
- Static assets belong in `public/`; `postinstall` populates `public/dict/` with Kuromoji dictionaries required for Japanese text parsing.
- Production build output lives in `.next/` after `npm run build`; treat it as generated (Vercel deployment target).

## Build, Test, and Development Commands
- `npm run dev` — start the local dev server at `http://localhost:3000`.
- `npm run lint` / `npm run type-check` — ESLint (Next config) and TypeScript strict checks.
- `npm run test` — runs lint, type-check, then `next build` to ensure the app still builds.
- `npm run build` — production build for Vercel deployment (no GitHub Pages basePath/assetPrefix).
- Prefer webpack for build/test (`npm run build -- --webpack`, add `-- --webpack` to `npm run test` if needed) because Turbopack currently fails in this sandbox when compiling `app/globals.css` (it tries to spawn a process that binds to a port, which the runtime forbids).
- `npm run preview` — build then run `next start` for a pre-deploy check.
- Run `npm install` once to copy Kuromoji dictionaries into `public/dict/` (handled by `postinstall`).

## Coding Style & Naming Conventions
- TypeScript with strict mode; prefer named functional components. Indent with 2 spaces, single quotes, and trailing commas where sensible.
- Use Tailwind classes for styling; compose conditionals with `clsx`/`tailwind-merge`. Keep component styles co-located with the component.
- Components: `PascalCase` filenames (e.g., `LyricsEditCard.tsx`); hooks: `useSomething`; utility modules: `camelCase`; types/interfaces: suffix with `Props`, `State`, or domain-specific names.
- Use the `@/*` path alias for absolute imports from the repo root.

## Testing Guidelines
- No standalone unit/integration harness is present yet; the current guardrail is `npm run test` (lint + types + build).
- When adding non-trivial logic (e.g., parsing, timing calculations), include targeted tests or lightweight validation scripts and wire them into `npm run test` if possible.
- Keep fixtures small and commit only deterministic test assets.

## Commit & Pull Request Guidelines
- Write concise, imperative commit messages in `type: Title` format (e.g., `feat: Add timing export controls`); group related changes.
- For PRs, include: summary of behavior change, linked issue/feature, and manual test notes. Add screenshots or clips for UI-facing updates.
- Ensure `npm run test` passes before requesting review; mention any skipped checks or follow-ups explicitly.
- Always run the app verification and lint checks before committing, and do not commit without explicit approval.

## Security & Configuration Tips
- The app targets Vercel (root path) now; asset URLs assume deployment at the domain root.
- Avoid committing generated build artifacts or large datasets; keep secrets out of config and favor environment variables when adding new integrations.

## useEffect Usage Guidelines
- Use `useEffect` only when truly necessary; consider better alternatives first.
- Appropriate uses: direct DOM manipulation, integrating external libraries (charts, animations), timers/intervals, browser APIs (localStorage, WebSocket, etc.).
- Avoid `useEffect` for: data transformation (prefer `useMemo` or inline calculations), event handlers (update state directly), derived state from props/state (calculate during render), API fetching (prefer TanStack Query, SWR, etc.).
- When using `useEffect`: ensure dependency arrays are complete and correct; implement cleanup for subscriptions/timers/event listeners; watch for infinite loops (especially with object/array deps); ensure effects run only as often as necessary.
