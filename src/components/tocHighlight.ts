import './tocHighlight.css'

(() => {
  interface TocLineItem {
    heading: HTMLHeadingElement
    label: string
    depth: number
    href: string
  }

  const toc = document.querySelector<HTMLElement>('aside#toc')
  const article = document.querySelector('article')
  if (!toc || !article)
    return

  const headings = Array.from(article.querySelectorAll<HTMLHeadingElement>('h2, h3, h4, h5, h6'))
    .filter(heading => heading.id)
  if (headings.length === 0)
    return

  const items = Array.from(toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
    .map((link) => {
      const hash = link.hash.slice(1)
      const id = hash ? decodeURIComponent(hash) : ''
      const heading = headings.find(target => target.id === id)
      if (!heading)
        return undefined

      return {
        heading,
        label: link.textContent?.trim() || heading.textContent?.trim() || '',
        depth: Number.parseInt(heading.tagName.slice(1), 10),
        href: link.getAttribute('href') || `#${encodeURIComponent(heading.id)}`,
      }
    })
    .filter((item): item is TocLineItem => Boolean(item))

  if (items.length === 0)
    return

  toc.remove()

  const lineToc = document.createElement('nav')
  lineToc.className = 'post-toc-lines'
  lineToc.setAttribute('aria-label', 'Table of Contents')

  const links = items.map((item) => {
    const link = document.createElement('a')
    link.className = 'post-toc-lines__item'
    link.href = item.href
    link.title = item.label
    link.setAttribute('aria-label', item.label)
    link.dataset.depth = String(item.depth)
    lineToc.append(link)
    return link
  })

  document.body.append(lineToc)

  let frame = 0

  const getHeadingScrollPosition = (heading: HTMLHeadingElement) => {
    const headingTop = heading.getBoundingClientRect().top + window.scrollY
    const maxScroll = document.documentElement.scrollHeight
    return maxScroll > 0 ? headingTop / maxScroll : 0
  }

  const update = () => {
    frame = 0

    items.forEach((item, index) => {
      const percent = getHeadingScrollPosition(item.heading) * 100
      links[index]?.style.setProperty('--toc-position', `${percent}%`)
    })

    const visibleIndexes = new Set<number>()
    const fallbackIndex = items.reduce((current, item, index) => {
      const rect = item.heading.getBoundingClientRect()
      const isVisible = rect.top >= 92 && rect.top <= window.innerHeight
      if (isVisible)
        visibleIndexes.add(index)

      return rect.top <= 112 ? index : current
    }, 0)

    links.forEach((link, index) => {
      const isActive = visibleIndexes.size > 0
        ? visibleIndexes.has(index)
        : index === fallbackIndex
      link.classList.toggle('active', isActive)
    })
  }

  const requestUpdate = () => {
    if (frame)
      return
    frame = window.requestAnimationFrame(update)
  }

  update()
  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', requestUpdate)
  window.addEventListener('load', requestUpdate)
})()

export default {}
