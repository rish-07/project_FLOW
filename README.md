# Booking Capture & Follow-up — starter files

Pre-written, config-heavy files for the SvelteKit + Cloudflare + BetterAuth + Drizzle + Gemini stack.
Drop these into the project so Claude Code builds on a correct foundation. Follow
`implementation-phases.md` for the build order.

## Layout
```
wrangler.toml                         Cloudflare bindings (D1 + R2) + nodejs_compat
package.json                          deps + scripts
drizzle.config.ts                     Drizzle Kit config for D1
.dev.vars.example                     local secrets template -> copy to .dev.vars
src/app.d.ts                          Platform.env + Locals types
src/hooks.server.ts                   session injection + auth route + redirect guard
src/lib/db/schema.ts                  full Drizzle schema (BetterAuth + app tables)
src/lib/db/index.ts                   createDb(d1) factory
src/lib/auth.ts                       createAuth(d1, secret) factory
src/lib/auth-client.ts               BetterAuth Svelte client
src/lib/gemini.ts                     extraction + Zod validation (prompt embedded)
src/lib/utils.ts                      phone / date / confidence helpers
src/routes/api/extract/+server.ts     R2 upload + Gemini + insert pipeline
src/routes/api/auth/[...all]/+server.ts  BetterAuth handler
```

## First-run commands
```bash
npm install
wrangler login
wrangler d1 create booking-db          # paste database_id into wrangler.toml
wrangler r2 bucket create booking-diary-photos
cp .dev.vars.example .dev.vars          # fill in GEMINI_API_KEY + BETTER_AUTH_SECRET
npm run db:generate
npm run db:migrate:local
npm run cf:dev                          # build + wrangler pages dev (D1/R2 only exist here)
```

## Notes
- `npm run dev` (plain Vite) will NOT have D1/R2 bindings. Use `npm run cf:dev`.
- Versions in package.json are indicative — run `npm install` and let Claude Code
  reconcile to the latest compatible set if needed.
- After first deploy, add the live *.pages.dev URL to `trustedOrigins` in src/lib/auth.ts.
