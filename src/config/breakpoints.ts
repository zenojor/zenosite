export const BREAKPOINTS = {
  mobile: 768,
  smallMobile: 638,
}

export function responsive<T>(values: { desktop: T; mobile: T }): T {
  return window.innerWidth < BREAKPOINTS.mobile ? values.mobile : values.desktop
}

export function isMobileViewport() {
  return window.innerWidth < BREAKPOINTS.mobile
}
