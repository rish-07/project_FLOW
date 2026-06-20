import { createAuth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = ['/login', '/setup'];

export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;

  // Auth needs Cloudflare bindings (D1 + secret). When present, let BetterAuth
  // own its endpoints and attach the session to locals.
  if (env?.DB) {
    const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET);

    if (event.url.pathname.startsWith('/api/auth')) {
      return auth.handler(event.request);
    }

    try {
      const result = await auth.api.getSession({ headers: event.request.headers });
      event.locals.user = result?.user ?? null;
      event.locals.session = result?.session ?? null;
    } catch {
      // Before migrations are applied the auth tables don't exist yet — treat
      // as logged-out rather than 500ing.
      event.locals.user = null;
      event.locals.session = null;
    }
  } else {
    event.locals.user = null;
    event.locals.session = null;
  }

  // Redirect guard. Enforced in every environment: any unauthenticated request
  // for a path outside PUBLIC_PATHS is sent to /login.
  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
  if (!event.locals.user && !isPublic) {
    throw redirect(302, '/login');
  }

  return resolve(event);
};
