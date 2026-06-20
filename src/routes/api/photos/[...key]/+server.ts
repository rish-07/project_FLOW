import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// R2 has no public URLs — diary photos are served only through this auth-gated
// route. The [...key] rest param captures the full object key (it contains
// slashes, e.g. diary-photos/<venueId>/<ts>.jpg).
export const GET: RequestHandler = async ({ params, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const key = params.key;
  if (!key) throw error(400, 'Missing key');

  const object = await platform!.env.DIARY_PHOTOS.get(key);
  if (!object) throw error(404, 'Not found');

  // The Cloudflare R2 body/headers types differ from the DOM lib types SvelteKit's
  // Response uses, though they're the same objects at runtime — cast the stream.
  return new Response(object.body as unknown as BodyInit, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'image/jpeg',
      etag: object.httpEtag,
      'cache-control': 'private, max-age=3600'
    }
  });
};
