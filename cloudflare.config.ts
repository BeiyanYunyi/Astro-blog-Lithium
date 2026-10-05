import { bindings, defineConfig, triggers } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'astro-blog-lithium',
    compatibilityDate: '2026-08-27',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: './src/server/worker.ts',
    observability: {
      logs: {
        enabled: true,
        invocationLogs: true,
        persist: true,
      },
      traces: {
        enabled: true,
        persist: true,
      },
    },
    assets: {
      notFoundHandling: '404-page',
      runWorkerFirst: [
        '/.well-known/webfinger',
        '/.well-known/webfinger/',
        '/api/*',
        '/posts/*',
      ],
    },
    triggers: [
      triggers.scheduled({
        schedule: '*/5 * * * *',
      }),
      triggers.queue({
        deadLetterQueue: 'blog-federation-dlq',
        maxBatchSize: 1,
        maxBatchTimeout: 1,
        maxConcurrency: 1,
        maxRetries: 12,
        name: 'blog-federation',
      }),
    ],
    env: {
      ap: bindings.d1({
        name: 'ap',
        id: '007ff8f3-681b-47e1-9f6e-e9ded6295b43',
      }),
      FEDERATION_QUEUE: bindings.queue({
        name: 'blog-federation',
      }),
      ASSETS: bindings.assets(),
    },
  },
});
