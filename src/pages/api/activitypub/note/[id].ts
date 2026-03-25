import type { APIRoute } from 'astro'
import { filePathToSlug } from '@utils/idToSlug'
import postToNote from '@utils/postToNote'
import { getCollection } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('posts')
  return posts.map(post => ({
    params: { id: filePathToSlug(post.filePath) },
  }))
}

export const GET: APIRoute = async ({ params }) => {
  const allPosts = await getCollection('posts')
  const post = allPosts.find(
    item => filePathToSlug(item.filePath) === params.id,
  )!

  return new Response(JSON.stringify(postToNote(post)))
}
