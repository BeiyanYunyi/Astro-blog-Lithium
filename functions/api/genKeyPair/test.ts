import { Env } from '../activitypub/types';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  return new Response(JSON.stringify({ pub: JSON.parse(ctx.env.PUBLIC_KEY) }));
};
