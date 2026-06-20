import { redirect } from '@sveltejs/kit';

// The app's home is the Leads dashboard (post-login landing).
export const load = () => {
  throw redirect(307, '/leads');
};
