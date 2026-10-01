export function isSubPageObstacleLine(lineText: string) {
  return lineText.trim() !== ''
}

/** Reserve every ASCII cell that overlaps the padded DOM bounds, including its edges. */
export function asciiCellOverlapsObstacle(
  x: number,
  y: number,
  width: number,
  height: number,
  rect: { x: number; y: number; width: number; height: number },
  paddingX: number,
  paddingY: number,
) {
  return x < rect.x + rect.width + paddingX &&
    x + width > rect.x - paddingX &&
    y < rect.y + rect.height + paddingY &&
    y + height > rect.y - paddingY
}
