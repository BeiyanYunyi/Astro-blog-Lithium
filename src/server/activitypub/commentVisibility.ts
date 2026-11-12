import { type Note, PUBLIC_COLLECTION } from '@fedify/vocab';

/** Only an explicit public audience on the object permits public rendering. */
export function isPublicComment(note: Note): boolean {
  return [...note.toIds, ...note.ccIds].some(
    (id) => id.href === PUBLIC_COLLECTION.href,
  );
}
