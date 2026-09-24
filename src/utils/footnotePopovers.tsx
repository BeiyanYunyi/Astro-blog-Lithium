import { createSignal, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

type Footnote = {
  reference: HTMLAnchorElement;
  source: Element;
  href: string;
};

function FootnotePopover(props: { article: Element }) {
  let popover!: HTMLDivElement;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let closing = false;
  let toggleTimer: ReturnType<typeof setTimeout> | undefined;
  const [active, setActive] = createSignal<Footnote>();
  const cancelClose = () => clearTimeout(closeTimer);
  const hide = () => {
    cancelClose();
    if (popover.matches(':popover-open')) popover.hidePopover();
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (
        !active()?.reference.matches(':hover, :focus') &&
        !popover.matches(':hover, :focus-within')
      )
        hide();
    }, 180);
  };
  const position = () => {
    const reference = active()?.reference;
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
  for (const reference of props.article.querySelectorAll<HTMLAnchorElement>(
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
    const source = props.article.querySelector(
      `.footnotes li#${CSS.escape(id)}`,
    );
    if (!source) continue;
    const footnote = { reference, source, href };
    const show = () => {
      cancelClose();
      if (closing) return;
      if (active() === footnote && popover.matches(':popover-open')) return;
      setActive(footnote);
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
  onCleanup(() => {
    controller.abort();
    cancelClose();
    clearTimeout(toggleTimer);
    observer.disconnect();
  });

  return (
    <Portal mount={props.article}>
      <div
        ref={(element) => {
          popover = element;
          observer.observe(element);
        }}
        class="footnote-popover prose prose-neutral dark:prose-invert fixed m-0 p-3 border border-solid border-stone-200 dark:border-stone-600 rounded-lg shadow-lg bg-white dark:bg-stone-800 text-neutral-800 dark:text-neutral-200 text-sm"
        popover="auto"
        tabIndex={-1}
        role="note"
        aria-label={`注释 ${active()?.reference.textContent?.trim() ?? ''}`}
        on:beforetoggle={(event) => {
          if (event.newState !== 'closed') return;
          // Ignore focus restored by native dismissal until the toggle completes.
          closing = true;
          clearTimeout(toggleTimer);
          toggleTimer = setTimeout(() => {
            closing = false;
          }, 0);
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        onFocusIn={cancelClose}
        onFocusOut={scheduleClose}
      >
        <Show when={active()} keyed>
          {(footnote) => {
            // Markdown remains the source; only the detached copy is modified.
            const content = footnote.source.cloneNode(true) as HTMLElement;
            for (const backref of content.querySelectorAll(
              '[data-footnote-backref]',
            )) {
              backref.remove();
            }
            for (const element of content.querySelectorAll('[id]')) {
              element.removeAttribute('id');
            }
            const sourceLink = (
              <a
                href={footnote.href}
                aria-label="跳转到脚注"
                title="跳转到脚注"
                onClick={hide}
              >
                ⬇️
              </a>
            );
            const lastParagraph = content.lastElementChild;
            // Keep the link inline with the final paragraph of the original note.
            if (lastParagraph?.tagName === 'P') {
              lastParagraph.append(' ', sourceLink as HTMLAnchorElement);
            } else {
              content.append(' ', sourceLink as HTMLAnchorElement);
            }
            return Array.from(content.childNodes);
          }}
        </Show>
      </div>
    </Portal>
  );
}

export default function FootnotePopovers() {
  if (!('showPopover' in HTMLElement.prototype)) return null;
  const element = document.querySelector('article.prose');
  if (!element?.querySelector('a[data-footnote-ref]')) return null;

  return <FootnotePopover article={element} />;
}
