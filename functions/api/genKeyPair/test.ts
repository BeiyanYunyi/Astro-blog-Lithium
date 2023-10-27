import { Env } from '../activitypub/types';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  return new Response(JSON.stringify({ pub: ctx.env.PUBLIC_KEY }));
};
