import { Env } from '../../../src/types';

/* eslint-disable import/prefer-default-export */
export const onRequest: PagesFunction<Env> = (context) => {
  if (context.request.headers.get('Accept')?.includes('json')) return context.next();
  const url = '/posts/'.concat(
    context.request
      .url!.replace(/https?:\/\/.*\/api\/activitypub\/note\//, '')
      .replaceAll('_', '/'),
  );
  return new Response(`Redirecting to ${url}`, {
    status: 302,
    headers: {
      Location: url,
    },
  });
};
