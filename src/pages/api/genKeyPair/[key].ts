import type { APIRoute } from 'astro';
import {
  arrayBufferToBase64,
  generateUserKey,
  importPrivKey,
  unwrapPrivateKey,
} from '@server/activitypub/key-ops';

export const GET: APIRoute = async (ctx) => {
  const res = await generateUserKey(ctx.params.key as string);
  const unwrapped = await unwrapPrivateKey(
    ctx.params.key as string,
    res.wrappedPrivKey,
    res.salt,
  );
  const priv = arrayBufferToBase64(
    new Uint8Array(
      (await crypto.subtle.exportKey('pkcs8', unwrapped)) as ArrayBuffer,
    ),
  );
  const priv2 = await importPrivKey(priv);
  return new Response(
    JSON.stringify({
      pub: res.pubKey,
      salt: arrayBufferToBase64(res.salt),
      priv,
      priv2: arrayBufferToBase64(
        new Uint8Array(
          (await crypto.subtle.exportKey('pkcs8', priv2)) as ArrayBuffer,
        ),
      ),
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};

export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, HEAD' },
  });

export const HEAD = GET;
