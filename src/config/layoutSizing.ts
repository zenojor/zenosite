/** Keep static ASCII blocks inside the viewport before falling back to scrolling. */
export function fitSubPageFontSize(
  widthBasedSize: number,
  minimumSize: number,
  viewportHeight: number,
  lineCount: number,
  verticalOffset = 0,
) {
  const offset = Math.floor(viewportHeight * verticalOffset)
  const heightBasedSize = Math.floor((viewportHeight - 2 * (20 + offset)) / Math.max(1, lineCount))
  return Math.max(minimumSize, Math.min(widthBasedSize, heightBasedSize))
}

export function getScrollViewport(viewportHeight: number) {
  const top = Math.min(80, Math.floor(viewportHeight * 0.15))
  const bottom = Math.min(100, Math.floor(viewportHeight * 0.2))
  return { top, height: Math.max(1, viewportHeight - top - bottom) }
}
