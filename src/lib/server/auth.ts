import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

// Factory: called per-request because platform.env is only available at request
// time in the Workers runtime. Do NOT instantiate at module scope.
export function createAuth(d1: D1Database, secret: string) {
  const db = createDb(d1);

  return betterAuth({
    secret,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification
      }
    }),
    emailAndPassword: {
      enabled: true
    },
    trustedOrigins: [
      'http://localhost:5173',
      'http://localhost:8788',
      // TODO: add your live Cloudflare Pages URL after first deploy:
      'https://booking-app.pages.dev'
    ]
  });
}

export type Auth = ReturnType<typeof createAuth>;
