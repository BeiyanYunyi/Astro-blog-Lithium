import type { Env as Bindings } from '@server/activitypub/types';

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}
  }
}
