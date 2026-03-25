import type { APIRoute } from 'astro'
import { filePathToSlug } from '@utils/idToSlug'
import postToCreate from '@utils/noteToCreate'
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

  return new Response(JSON.stringify(postToCreate(post)))
}
