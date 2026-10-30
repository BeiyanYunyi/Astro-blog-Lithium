<script lang="ts">
  import { onMount } from 'svelte';

  type Mode = 'auto' | 'light' | 'dark';
  let mode = $state<Mode>('auto');
  let systemDark = $state(false);
  let ready = $state(false);
  const dark = $derived(mode === 'auto' ? systemDark : mode === 'dark');

  function refreshDark() {
    document.documentElement.classList.toggle('dark', dark);
  }

  onMount(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem('dark-mode') ?? 'null',
      );
      if (stored === 'auto' || stored === 'light' || stored === 'dark')
        mode = stored;
    } catch {
      // Storage can be unavailable or contain an invalid value.
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark = media.matches;
    ready = true;
    const updateSystem = (event: MediaQueryListEvent) => {
      systemDark = event.matches;
    };
    media.addEventListener('change', updateSystem);
    document.addEventListener('astro:page-load', refreshDark);
    return () => {
      media.removeEventListener('change', updateSystem);
      document.removeEventListener('astro:page-load', refreshDark);
    };
  });

  $effect(() => {
    if (!ready) return;
    refreshDark();
    try {
      localStorage.setItem('dark-mode', JSON.stringify(mode));
    } catch {
      // Theme switching still works when storage is unavailable.
    }
  });
</script>

<button
  type="button"
  onclick={() => { mode = mode === 'auto' ? (systemDark ? 'light' : 'dark') : 'auto'; }}
  aria-label={mode === 'auto' ? (dark ? '切换到浅色模式' : '切换到深色模式') : '跟随系统主题'}
  class={['ml-2 text-2xl', mode === 'auto' ? 'i-ion:transgender-outline' : dark ? 'i-ion:moon-outline' : 'i-ion:sunny-outline']}
></button>
