import { Env } from '../src/types';

/* eslint-disable import/prefer-default-export */
export const onRequest: PagesFunction<Env> = async (context) => {
  if (!context.request.headers.get('Accept')?.includes('json')) return context.next();
  const url = `/api/activitypub/note/${(context.params.slug as string).replaceAll('/', '_')}`;
  return new Response(`Redirecting to ${url}`, {
    status: 302,
    headers: {
      Location: url,
    },
  });
};
