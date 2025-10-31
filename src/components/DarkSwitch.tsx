import type { Component } from 'solid-js'
import { makePersisted } from '@solid-primitives/storage'
import { createEffect, createRoot, createSignal, Show } from 'solid-js'

function createDarkMode() {
  const [darkMode, setDarkMode] = makePersisted(
    // eslint-disable-next-line solid/reactivity
    createSignal<'auto' | 'light' | 'dark'>('auto'),
    { storage: localStorage, name: 'dark-mode' },
  )
  const [systemDark, setSystemDark] = createSignal(
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const dark = () =>
    darkMode() === 'auto' ? systemDark() : darkMode() === 'dark'

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      if (darkMode() === 'auto')
        setSystemDark(e.matches)
    })

  const refreshDark = () => {
    if (dark()) {
      window.document.documentElement.classList.add('dark')
    }
    else {
      window.document.documentElement.classList.remove('dark')
    }
  }
  createEffect(() => {
    if (dark()) {
      window.document.documentElement.classList.add('dark')
    }
    else {
      window.document.documentElement.classList.remove('dark')
    }
  })
  document.addEventListener('astro:page-load', refreshDark)
  return { darkMode, setDarkMode, systemDark, refreshDark, dark }
}

export const darkMode = createRoot(createDarkMode)

const DarkSwitch: Component = () => (
  <Show
    when={darkMode.darkMode() === 'auto'}
    fallback={(

      <button
        onClick={(e) => {
          e.preventDefault()
          darkMode.setDarkMode('auto')
        }}
        aria-label="Turn on dark mode"
        class={`ml-2 text-2xl ${darkMode.dark() ? 'i-ion:moon-outline' : 'i-ion:sunny-outline'}`}
      />
    )}
  >
    <button
      onClick={(e) => {
        e.preventDefault()
        darkMode.setDarkMode(darkMode.systemDark() ? 'light' : 'dark')
      }}
      aria-label="Turn off dark mode"
      class="i-ion:transgender-outline ml-2 text-2xl"
    />
  </Show>
)

export default DarkSwitch
