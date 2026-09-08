import type { CollectionEntry } from 'astro:content';
import { Note, PUBLIC_COLLECTION } from '@fedify/vocab';
import actorURL from '@server/activitypub/actorURL';
import { Temporal } from 'temporal-polyfill';
import { filePathToSlug } from './idToSlug';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char,
  );

function postToNote(post: CollectionEntry<'posts'>) {
  const slug = filePathToSlug(post.filePath);
  const url = new URL(`https://blog.yunyi.beiyan.us/posts/${slug}`);
  return new Note({
    id: new URL(`https://blog.yunyi.beiyan.us/api/activitypub/note/${slug}`),
    attribution: new URL(actorURL),
    ccs: [new URL('https://blog.yunyi.beiyan.us/api/activitypub/followers')],
    content: `<p><a href="${escapeHtml(url.href)}">${escapeHtml(post.data.title)}</a></p><p>${escapeHtml(post.data.description || '')}</p>`,
    published: Temporal.Instant.from(post.data.date.toISOString()),
    tos: [PUBLIC_COLLECTION],
    url,
  });
}

export default postToNote;
