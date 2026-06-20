import { redirect, fail } from '@sveltejs/kit';
import { createAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

// One-time owner creation. Once any user exists this route is closed for good —
// there is no registration UI anywhere else in the app.
export const load: PageServerLoad = async ({ platform }) => {
  const db = createDb(platform!.env.DB);
  const existing = await db.select().from(user).limit(1);
  if (existing.length > 0) throw redirect(302, '/login');
  return {};
};

export const actions: Actions = {
  default: async ({ request, platform }) => {
    const env = platform!.env;
    const db = createDb(env.DB);

    // Defence in depth: never create a second owner, even on a racing submit.
    const existing = await db.select().from(user).limit(1);
    if (existing.length > 0) throw redirect(302, '/login');

    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!name || !email || !password) {
      return fail(400, { error: 'All fields are required.', name, email });
    }
    if (password.length < 8) {
      return fail(400, { error: 'Password must be at least 8 characters.', name, email });
    }

    const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET);
    try {
      await auth.api.signUpEmail({ body: { name, email, password } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not create the account.';
      return fail(400, { error: message, name, email });
    }

    throw redirect(303, '/login');
  }
};
