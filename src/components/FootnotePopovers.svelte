<script lang="ts">
  type Footnote = {
    reference: HTMLAnchorElement;
    source: Element;
    href: string;
  };
  let active = $state.raw<Footnote>();
  function setupPopover(popover: HTMLDivElement) {
    if (!('showPopover' in HTMLElement.prototype)) return;
    const article = document.querySelector('article.prose');
    if (!article?.querySelector('a[data-footnote-ref]')) return;
    article.append(popover);
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let closing = false;
    let toggleTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelClose = () => clearTimeout(closeTimer);
    const hide = () => {
      cancelClose();
      if (popover.matches(':popover-open')) popover.hidePopover();
    };
    const scheduleClose = () => {
      cancelClose();
      closeTimer = setTimeout(() => {
        if (
          !active?.reference.matches(':hover, :focus') &&
          !popover.matches(':hover, :focus-within')
        )
          hide();
      }, 180);
    };
    const position = () => {
      const reference = active?.reference;
      if (!reference || !popover.matches(':popover-open')) return;
      const anchor = reference.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      // Focus fires before the browser scrolls a keyboard target into view.
      if (
        (anchor.bottom < 0 || anchor.top > height) &&
        !reference.matches(':focus') &&
        !popover.matches(':focus-within')
      )
        return hide();
      const bounds = popover.getBoundingClientRect();
      const below = anchor.bottom + 8;
      const top =
        below + bounds.height <= height - 16
          ? below
          : anchor.top - bounds.height - 8;
      popover.style.left = `${Math.max(16, Math.min(anchor.left, width - bounds.width - 16))}px`;
      popover.style.top = `${Math.max(16, Math.min(top, height - bounds.height - 16))}px`;
    };

    const controller = new AbortController();
    const { signal } = controller;

    function renderContent(footnote: Footnote) {
      // Clone authored Markdown; remove duplicate IDs and back references.
      const content = footnote.source.cloneNode(true) as HTMLElement;
      for (const backref of content.querySelectorAll('[data-footnote-backref]'))
        backref.remove();
      for (const element of content.querySelectorAll('[id]'))
        element.removeAttribute('id');
      const sourceLink = document.createElement('a');
      sourceLink.href = footnote.href;
      sourceLink.setAttribute('aria-label', '跳转到脚注');
      sourceLink.title = '跳转到脚注';
      sourceLink.textContent = '⬇️';
      sourceLink.addEventListener('click', hide, { signal });
      const lastParagraph = content.lastElementChild;
      (lastParagraph?.tagName === 'P' ? lastParagraph : content).append(
        ' ',
        sourceLink,
      );
      popover.replaceChildren(...content.childNodes);
    }
    popover.addEventListener(
      'beforetoggle',
      (event) => {
        if ((event as ToggleEvent).newState !== 'closed') return;
        closing = true;
        clearTimeout(toggleTimer);
        toggleTimer = setTimeout(() => {
          closing = false;
        }, 0);
      },
      { signal },
    );
    popover.addEventListener('pointerenter', cancelClose, { signal });
    popover.addEventListener('pointerleave', scheduleClose, { signal });
    popover.addEventListener('focusin', cancelClose, { signal });
    popover.addEventListener('focusout', scheduleClose, { signal });

    for (const reference of article.querySelectorAll<HTMLAnchorElement>(
      'a[data-footnote-ref]',
    )) {
      const href = reference.getAttribute('href');
      if (!href?.startsWith('#')) continue;
      let id: string;
      try {
        id = decodeURIComponent(href.slice(1));
      } catch {
        continue;
      }
      const source = article.querySelector(`.footnotes li#${CSS.escape(id)}`);
      if (!source) continue;
      const footnote = { reference, source, href };
      const show = () => {
        cancelClose();
        if (closing) return;
        if (active === footnote && popover.matches(':popover-open')) return;
        active = footnote;
        renderContent(footnote);
        popover.showPopover();
        position();
      };
      reference.addEventListener(
        'pointerenter',
        (event) => {
          if (event.pointerType !== 'touch') show();
        },
        { signal },
      );
      reference.addEventListener('pointerleave', scheduleClose, { signal });
      reference.addEventListener('focus', show, { signal });
      reference.addEventListener('blur', scheduleClose, { signal });
      reference.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          // An explicit click can reopen a hover popover dismissed by pointerdown.
          closing = false;
          clearTimeout(toggleTimer);
          show();
          // Keep touch-opened notes visible and make their links reachable by Tab.
          popover.focus({ preventScroll: true });
        },
        { signal },
      );
    }
    window.addEventListener('resize', position, { signal });
    document.addEventListener('scroll', position, { signal, capture: true });
    const observer = new ResizeObserver(position);
    observer.observe(popover);
    return {
      destroy() {
        controller.abort();
        cancelClose();
        clearTimeout(toggleTimer);
        observer.disconnect();
        popover.remove();
      },
    };
  }
</script>
<div
  use:setupPopover
  class="footnote-popover prose prose-neutral dark:prose-invert fixed m-0 p-3 border border-solid border-stone-200 dark:border-stone-600 rounded-lg shadow-lg bg-white dark:bg-stone-800 text-neutral-800 dark:text-neutral-200 text-sm"
  popover="auto"
  tabindex="-1"
  role="note"
  aria-label={`注释 ${active?.reference.textContent?.trim() ?? ''}`}
></div>
