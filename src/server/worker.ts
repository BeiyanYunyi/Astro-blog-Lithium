import astro from '@astrojs/cloudflare/entrypoints/server';
import type { MessageBatch } from '@cloudflare/workers-types';
import { WorkersMessageQueue } from '@fedify/cfworkers';
import type { Message } from '@fedify/fedify';
import { createBlogFederation } from './activitypub/federation';
import {
  type PublicationTask,
  publishBatch,
  scanPublications,
} from './activitypub/publications';
import type { Env } from './activitypub/types';

export default {
  fetch: astro.fetch,
  async scheduled(_controller: unknown, env: Env) {
    await scanPublications(env);
  },
  async queue(batch: MessageBatch<Message | PublicationTask>, env: Env) {
    const federation = await createBlogFederation(env);
    const queue = new WorkersMessageQueue(env.FEDERATION_QUEUE);
    for (const message of batch.messages) {
      try {
        if (message.body.type === 'blog-publish') {
          await publishBatch(env, federation, message.body);
        } else {
          const task = await queue.processMessage(message.body);
          if (!task.shouldProcess) {
            message.retry();
            continue;
          }
          try {
            await federation.processQueuedTask(env, task.message);
          } finally {
            await task.release?.();
          }
        }
        message.ack();
      } catch (error) {
        console.error('ActivityPub queue task failed', {
          messageId: message.id,
          error,
        });
        message.retry({
          delaySeconds: Math.min(3600, 30 * 2 ** (message.attempts - 1)),
        });
      }
    }
  },
};
