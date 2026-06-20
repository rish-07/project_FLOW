import { createAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ request, platform }) => {
  const env = platform!.env;
  const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET);
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
