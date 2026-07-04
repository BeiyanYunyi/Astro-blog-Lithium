import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount } from 'solid-js'

interface TocHeading {
  depth: number
  slug: string
  text: string
}

interface TocLineItem {
  heading: HTMLHeadingElement
  label: string
  depth: number
  href: string
}

type TocPopover = HTMLElement & {
  hidePopover?: () => void
  showPopover?: () => void
}

function getHeadingScrollPosition(heading: HTMLHeadingElement) {
  const headingTop = heading.getBoundingClientRect().top + window.scrollY
  const maxScroll = document.documentElement.scrollHeight
  return maxScroll > 0 ? headingTop / maxScroll : 0
}

function getTooltipId(item: TocLineItem) {
  return `post-toc-tooltip-${encodeURIComponent(item.heading.id)}`
}

const TocHighlight: Component<{ headings: TocHeading[] }> = (props) => {
  const [items, setItems] = createSignal<TocLineItem[]>([])
  const [positions, setPositions] = createSignal<number[]>([])
  const [activeIndexes, setActiveIndexes] = createSignal<Set<number>>(new Set())
  const popovers = new Map<number, TocPopover>()
  let frame = 0

  const update = () => {
    frame = 0
    const currentItems = items()

    setPositions(currentItems.map(item => getHeadingScrollPosition(item.heading) * 100))

    const visibleIndexes = new Set<number>()
    const fallbackIndex = currentItems.reduce((current, item, index) => {
      const rect = item.heading.getBoundingClientRect()
      const isVisible = rect.top >= 92 && rect.top <= window.innerHeight
      if (isVisible)
        visibleIndexes.add(index)

      return rect.top <= 112 ? index : current
    }, 0)

    setActiveIndexes(
      visibleIndexes.size > 0
        ? visibleIndexes
        : new Set([fallbackIndex]),
    )
  }

  const requestUpdate = () => {
    if (frame)
      return

    frame = window.requestAnimationFrame(update)
  }

  const showTooltip = (index: number) => {
    popovers.get(index)?.showPopover?.()
  }

  const hideTooltip = (index: number) => {
    popovers.get(index)?.hidePopover?.()
  }

  onMount(() => {
    const toc = document.querySelector<HTMLElement>('aside#toc')
    const article = document.querySelector('article')
    if (!article)
      return

    const articleHeadings = Array.from(
      article.querySelectorAll<HTMLHeadingElement>('h2, h3, h4, h5, h6'),
    )

    const lineItems = props.headings
      .filter(heading => heading.slug !== 'footnote-label')
      .map((heading) => {
        const target = articleHeadings.find(articleHeading => articleHeading.id === heading.slug)
        if (!target)
          return undefined

        return {
          heading: target,
          label: heading.text || target.textContent?.trim() || '',
          depth: heading.depth,
          href: `#${encodeURIComponent(heading.slug)}`,
        }
      })
      .filter((item): item is TocLineItem => Boolean(item))

    if (lineItems.length === 0)
      return

    toc?.remove()
    setItems(lineItems)
    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    window.addEventListener('load', requestUpdate)
  })

  onCleanup(() => {
    if (frame)
      window.cancelAnimationFrame(frame)

    window.removeEventListener('scroll', requestUpdate)
    window.removeEventListener('resize', requestUpdate)
    window.removeEventListener('load', requestUpdate)
  })

  return (
    <nav
      class="pointer-events-none fixed inset-y-0 right-0 z-30 hidden w-12 lg:block"
      aria-label="Table of Contents"
    >
      <For each={items()}>
        {(item, index) => {
          const tooltipId = getTooltipId(item)
          const positionStyle = () => `--toc-position: ${positions()[index()] ?? 50}%`
          const isActive = () => activeIndexes().has(index())

          return (
            <>
              <a
                class="pointer-events-auto absolute right-0 top-[var(--toc-position)] block h-1 rounded-l-full transition-[width,height,background-color,opacity] duration-[160ms] ease-in-out -translate-y-1/2 hover:bg-blue-500/95 focus-visible:outline-2 focus-visible:outline-blue-500/80 focus-visible:outline-offset-3 dark:hover:bg-blue-400/95"
                classList={{
                  'bg-neutral-400/55 dark:bg-neutral-300/45': !isActive(),
                  'h-1.5 bg-blue-500/95 dark:bg-blue-400/95': isActive(),
                  'w-7': item.depth <= 2,
                  'w-[1.35rem]': item.depth === 3,
                  'w-4': item.depth === 4,
                  'w-3': item.depth >= 5,
                }}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                aria-describedby={tooltipId}
                style={positionStyle()}
                onMouseEnter={() => showTooltip(index())}
                onMouseLeave={() => hideTooltip(index())}
                onFocus={() => showTooltip(index())}
                onBlur={() => hideTooltip(index())}
              />
              <div
                ref={element => popovers.set(index(), element)}
                id={tooltipId}
                class="[overflow-wrap:anywhere] pointer-events-none fixed left-auto right-10 top-[var(--toc-position)] m-0 max-w-72 border border-neutral-200/90 rounded-md bg-white/95 px-2.5 py-1.5 text-sm text-neutral-800 leading-[1.35] shadow-lg -translate-y-1/2 dark:border-neutral-700/95 dark:bg-neutral-900/95 dark:text-neutral-100"
                popover="manual"
                role="tooltip"
                style={positionStyle()}
              >
                {item.label}
              </div>
            </>
          )
        }}
      </For>
    </nav>
  )
}

export default TocHighlight
