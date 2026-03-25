import path from 'node:path'

const mdRegex = /\.mdx?/
const idToSlug = (id: string) => id.replace(mdRegex, '')

export function filePathToSlug(filePath?: string) {
  if (!filePath)
    throw new Error('filePath is required')
  const fileName = path.basename(filePath)
  return idToSlug(fileName)
}

export default idToSlug
