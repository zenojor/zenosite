import type { RouteLocationNormalizedLoaded } from 'vue-router'

export type PageName = 'home' | 'about' | 'experience' | 'projects' | 'contact'

export const PAGE_NAMES: PageName[] = ['home', 'about', 'experience', 'projects', 'contact']

export const PAGE_PATHS = {
  home: '/',
  about: '/about',
  experience: '/experience',
  projects: '/projects',
  contact: '/contact',
} satisfies Record<PageName, string>

const PAGE_NAME_SET = new Set<PageName>(PAGE_NAMES)

export function isPageName(value: unknown): value is PageName {
  return typeof value === 'string' && PAGE_NAME_SET.has(value as PageName)
}

export function getPageFromRoute(route: RouteLocationNormalizedLoaded): PageName {
  return isPageName(route.meta.page) ? route.meta.page : 'home'
}
