import actorURL from '../const/actorURL';
import type { Env } from '../types';
import { getPrivateKey } from './getKey';
import { signRequest } from './http-signing';
import { generateDigestHeader } from './http-signing-cavage';

class AppRequest extends Request {
  private privBody: string;

  constructor(
    requestInfo: RequestInfo<CfProperties<unknown>>,
    requestInit?: Omit<RequestInit<CfProperties<unknown>>, 'body'> & { body: string },
  ) {
    super(requestInfo, { ...requestInit, method: 'post' });
    this.privBody = requestInit?.body;
    this.headers.set('Content-Type', 'application/activity+json');
    this.headers.set('Accept', 'application/activity+json');
  }

  public async digestAndSign(env: Env) {
    const digest = await generateDigestHeader(this.privBody);
    this.headers.set('Digest', digest);
    const privKey = await getPrivateKey(env);
    await signRequest(this, privKey, new URL(actorURL));
  }
}

export default AppRequest;
