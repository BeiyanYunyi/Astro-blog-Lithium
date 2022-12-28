import { Component, createEffect, createRoot, createSignal, Show } from 'solid-js';

const createDarkMode = () => {
  const [dark, setDark] = createSignal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    setDark(e.matches);
  });
  createEffect(() => {
    if (dark()) {
      window.document.documentElement.classList.add('dark');
    } else {
      window.document.documentElement.classList.remove('dark');
    }
  });
  return { dark, setDark };
};

export const darkMode = createRoot(createDarkMode);

const DarkSwitch: Component = () => (
  <Show
    when={darkMode.dark()}
    fallback={
      <button
        onClick={(e) => {
          e.preventDefault();
          darkMode.setDark(true);
        }}
        aria-label="Turn on dark mode"
        class="i-ion:moon-outline text-2xl"
      />
    }
  >
    <button
      onClick={(e) => {
        e.preventDefault();
        darkMode.setDark(false);
      }}
      aria-label="Turn off dark mode"
      class="i-ion:sunny-outline text-2xl"
    />
  </Show>
);

export default DarkSwitch;
