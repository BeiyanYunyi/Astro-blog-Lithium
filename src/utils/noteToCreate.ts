import type { CollectionEntry } from 'astro:content';
import { Create, PUBLIC_COLLECTION } from '@fedify/vocab';
import actorURL from '@server/activitypub/actorURL';
import { filePathToSlug } from './idToSlug';
import postToNote from './postToNote';

function postToCreate(post: CollectionEntry<'posts'>) {
  const note = postToNote(post);
  return new Create({
    id: new URL(
      `https://blog.yunyi.beiyan.us/api/activitypub/create/${filePathToSlug(post.filePath)}`,
    ),
    actor: new URL(actorURL),
    published: note.published,
    tos: [PUBLIC_COLLECTION],
    ccs: [new URL('https://blog.yunyi.beiyan.us/api/activitypub/followers')],
    object: note,
  });
}

export default postToCreate;
