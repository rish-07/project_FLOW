# Booking Capture & Follow-up app

A mobile-first web app for an event organiser. She uploads a photo of a vendor's
handwritten booking diary; Gemini extracts the bookings; she confirms them; then she
works a follow-up call list (tap-to-call / WhatsApp, status tracking). Single-user.

## Stack
SvelteKit + TypeScript · Tailwind v4 · Cloudflare Pages/Workers · Cloudflare D1 (SQLite) ·
Drizzle ORM · Cloudflare R2 · BetterAuth (email+password) · Google Gemini (`gemini-2.5-flash`).

## Commands
- `npm run cf:dev` — build + `wrangler pages dev`. **Use this for development.**
- `npm run dev` — plain Vite. **D1/R2/secrets are NOT bound here.** Avoid for anything touching data.
- `npm run db:generate` — generate Drizzle migration from `src/lib/server/db/schema.ts`.
- `npm run db:migrate:local` / `:remote` — apply migrations.
- `npm run deploy` — build + `wrangler pages deploy`.

## Project layout
- **`src/lib/server/*` is server-only** — SvelteKit refuses to bundle it into client code, so the
  Gemini key / DB / auth secret can never leak. Keep all secret-touching modules here.
- `src/lib/server/db/schema.ts` — Drizzle schema (BetterAuth tables + `venues`, `leads`).
- `src/lib/server/db/index.ts` — `createDb(d1)` factory.
- `src/lib/server/auth.ts` — `createAuth(d1, secret)` factory. `src/lib/auth-client.ts` — Svelte client (client-safe).
- `src/lib/server/gemini.ts` — extraction + Zod validation. Prompt is embedded; keep it verbatim.
- `src/lib/server/cleanup.ts` — retention sweep of stale unconfirmed leads + orphan R2 photos.
- `src/lib/utils.ts` — phone/date/confidence helpers (shared client + server).
- `src/hooks.server.ts` — session injection + `/api/auth` handler + redirect guard.
- `src/routes/{upload,confirm,leads,calls}` — the four screens.
- `src/routes/api/{extract,auth,leads,photos}` — server routes.

## Hard rules (this stack bites in specific ways)
- **`nodejs_compat` must stay in `wrangler.toml`.** Without it `Buffer` is undefined and Gemini base64 breaks.
- **D1 is SQLite, not Postgres.** IDs are `text`; booleans are `integer { mode: 'boolean' }`; dates compared as ISO strings.
- **Create `createAuth()` / `createDb()` per request**, inside handlers/hooks — never at module scope. `platform.env` only exists at request time.
- **Gemini runs server-side only.** It lives in `$lib/server/gemini` — SvelteKit blocks client imports of `$lib/server/*` at build time, so the API key can never reach the browser. Keep new secret-touching code under `$lib/server/`.
- **All data mutations go through server routes.** No direct D1 access from components.
- **R2 has no public URLs** — serve diary photos via `/api/photos/[key]`.
- **`wa.me` links use no `+`** (`https://wa.me/919876543210`). `tel:` links keep the `+`.

## Always do
- Run `svelte-check` / type-check after changes; fix type errors before moving on.
- Keep the Gemini prompt in `gemini.ts` byte-for-byte as written — do not paraphrase it.
- Preserve the **confirm screen**: extracted bookings are never written as confirmed until the
  user reviews them, and any field with `confidence < 0.75` must be visually flagged. This is a
  safety requirement, not a nicety — a misread phone digit costs a real booking.
- Match the design direction (premium, calm, dark-mode-first). See `docs/implementation-phases.md` §10.
- Make minimal, scoped changes. Don't refactor unrelated code.
- All UI components must follow the design system in `docs/design-system.md` 
  (Major Third type scale, 8-point grid, 60-30-10 color rule, WCAG contrast, 
  premium micro-interactions). Check it before building any new component.

## Never do
- Never commit secrets. `GEMINI_API_KEY` / `BETTER_AUTH_SECRET` live in `.dev.vars` (local) and
  `wrangler secret` (prod). `.dev.vars` is gitignored.
- Never auto-save extracted data or remove the confirm step.
- Never add registration UI — accounts are created once via the guarded `/setup` route.
- Don't use `localStorage`/`sessionStorage` for cross-page state; pass `session_id` as a URL param.

## Detailed docs (read on demand, not every session)
- `docs/claude-code-brief-final.md` — full spec (schemas, screens, design).
- `docs/implementation-phases.md` — build order + per-phase instructions.
- `docs/gemini-extraction-prompt.md` — the extraction prompt and its rationale.

When starting a new phase, read the matching section of `docs/implementation-phases.md` first.
