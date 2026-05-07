export const BREAKPOINTS = {
  mediumDesktop: 1333,
  tablet: 1024,
  mobile: 768,
  smallMobile: 638,
}

export function responsive<T>(values: { desktop: T; medium?: T; tablet?: T; mobile: T }): T {
  if (window.innerWidth < BREAKPOINTS.mobile) return values.mobile
  if (values.tablet !== undefined && window.innerWidth < BREAKPOINTS.tablet) return values.tablet
  if (values.medium !== undefined && window.innerWidth < BREAKPOINTS.mediumDesktop) return values.medium
  return values.desktop
}

export function isMobileViewport() {
  return window.innerWidth < BREAKPOINTS.mobile
}
