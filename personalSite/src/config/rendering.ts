export const MAX_RENDER_PIXEL_RATIO = 1.75

export function clampPixelRatio(value: number) {
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(value, MAX_RENDER_PIXEL_RATIO)
}

export function getRenderPixelRatio() {
  if (typeof window === 'undefined') return 1
  return clampPixelRatio(window.devicePixelRatio)
}
