/* eslint-disable import/prefer-default-export */
import { Env } from '../../src/types';
import {
  arrayBufferToBase64,
  generateUserKey,
  importPrivKey,
  unwrapPrivateKey,
} from '../../src/utils/key-ops';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const res = await generateUserKey(ctx.params.key as string);
  const unwrapped = await unwrapPrivateKey(ctx.params.key as string, res.wrappedPrivKey, res.salt);
  const priv = arrayBufferToBase64(
    new Uint8Array((await crypto.subtle.exportKey('pkcs8', unwrapped)) as ArrayBuffer),
  );
  const priv2 = await importPrivKey(priv);
  return new Response(
    JSON.stringify({
      pub: res.pubKey,
      salt: arrayBufferToBase64(res.salt),
      priv,
      priv2: arrayBufferToBase64(
        new Uint8Array((await crypto.subtle.exportKey('pkcs8', priv2)) as ArrayBuffer),
      ),
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};
