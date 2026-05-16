import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'night'

const STORAGE_KEY = 'zenosite-theme'

const getSystemTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'light'
}

const readStoredTheme = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'night' ? stored : null
}

const applyTheme = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = mode
}

export const themeMode = ref<ThemeMode>(readStoredTheme() ?? getSystemTheme())
export const isNightMode = computed(() => themeMode.value === 'night')

let mediaQuery: MediaQueryList | null = null

export const initThemeMode = () => {
  applyTheme(themeMode.value)

  if (typeof window === 'undefined') return
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (event) => {
    if (readStoredTheme()) return
    themeMode.value = event.matches ? 'night' : 'light'
    applyTheme(themeMode.value)
  })
}

export const toggleThemeMode = () => {
  themeMode.value = themeMode.value === 'night' ? 'light' : 'night'
  window.localStorage.setItem(STORAGE_KEY, themeMode.value)
  applyTheme(themeMode.value)
}

export const getThemeSurfaceColor = (mode = themeMode.value) => (mode === 'night' ? 0x121212 : 0xffffff)
export const getThemeMirrorTint = (mode = themeMode.value) => (mode === 'night' ? 0x4f5560 : 0xcccccc)
