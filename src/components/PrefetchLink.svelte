<script lang="ts">
  import type { Snippet } from 'svelte';

  let { href, children }: { href: string; children?: Snippet } = $props();
  let cachedHref: string | undefined;
  let content: Promise<string> | undefined;

  function loadPage() {
    if (!content || cachedHref !== href) {
      cachedHref = href;
      content = fetch(href).then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${response.url}`);
        return response.text();
      });
    }
    return content;
  }

  function prefetch() {
    void loadPage().catch(() => {
      content = undefined;
    });
  }

  async function handleClick(event: MouseEvent) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    const destination = href;
    try {
      const html = await loadPage();
      const newDom = new DOMParser().parseFromString(html, 'text/html');
      document.head.innerHTML = newDom.head.innerHTML;
      document.body.innerHTML = newDom.body.innerHTML;
      window.history.pushState({}, '', destination);
    } catch {
      window.location.assign(destination);
    }
  }
</script>

<a {href} onclick={handleClick} onpointerenter={prefetch} onfocus={prefetch}>
  {@render children?.()}
</a>
