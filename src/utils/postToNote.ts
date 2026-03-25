import type { CollectionEntry } from "astro:content"
import { filePathToSlug } from "./idToSlug"

function postToNote(post: CollectionEntry<"posts">) {
  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      {
        HashTag: "as:HashTag",
      },
    ],
    'id': `https://blog.yunyi.beiyan.us/api/activitypub/note/${filePathToSlug(post.filePath)}`,
    'type': "Note",
    'attributedTo': "https://blog.yunyi.beiyan.us/api/activitypub/actor",
    'cc': ["https://blog.yunyi.beiyan.us/api/activitypub/followers"],
    'content': `<p><a href="https://blog.yunyi.beiyan.us/posts/${filePathToSlug(post.filePath)}">${
      post.data.title
    }</a></p><p>${post.data.description || ""}</p>`,
    'published': post.data.date.toISOString(),
    'to': ["https://www.w3.org/ns/activitystreams#Public"],
    'url': `https://blog.yunyi.beiyan.us/posts/${filePathToSlug(post.filePath)}`,
  }
}

export default postToNote
