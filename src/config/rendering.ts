export const MAX_RENDER_PIXEL_RATIO = 1.75
export const MAX_REFLECTION_SIZE = 1024

/** A soft reflection does not need the main canvas's high-DPI resolution. */
export function getReflectionSize(width: number, height: number) {
  const scale = Math.min(0.75, MAX_REFLECTION_SIZE / Math.max(width, height, 1))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function clampPixelRatio(value: number) {
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(value, MAX_RENDER_PIXEL_RATIO)
}

export function getRenderPixelRatio() {
  if (typeof window === 'undefined') return 1
  return clampPixelRatio(window.devicePixelRatio)
}
