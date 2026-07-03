import type { MarkdownHeading } from 'astro'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function openList() {
  return '<ul>'
}

function closeList() {
  return '</ul>'
}

function headingsToToc(headings: MarkdownHeading[]) {
  const visibleHeadings = headings.filter(
    heading => heading.slug !== 'footnote-label',
  )

  if (visibleHeadings.length === 0) {
    return undefined
  }

  let currentDepth = visibleHeadings[0]!.depth
  let html = '<ul>'

  visibleHeadings.forEach((heading, index) => {
    const headingDepth = Math.min(heading.depth, currentDepth + 1)

    if (index > 0 && headingDepth <= currentDepth) {
      html += '</li>'
    }

    while (currentDepth < headingDepth) {
      html += openList()
      currentDepth += 1
    }

    while (currentDepth > headingDepth) {
      html += `${closeList()}</li>`
      currentDepth -= 1
    }

    html += `<li><a href="#${encodeURIComponent(heading.slug)}">${escapeHtml(heading.text)}</a>`
  })

  html += '</li>'

  while (currentDepth > visibleHeadings[0]!.depth) {
    html += `${closeList()}</li>`
    currentDepth -= 1
  }

  return `${html}${closeList()}`
}

export default headingsToToc
