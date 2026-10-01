import assert from 'node:assert/strict'
import test from 'node:test'
import { asciiCellOverlapsObstacle, isSubPageObstacleLine } from './subPageObstacles.ts'

test('subpage frame-only lines still reserve the content box area', () => {
  assert.equal(isSubPageObstacleLine('║                                                                 ║'), true)
  assert.equal(isSubPageObstacleLine('╔═════════════════════════════════════════════════════════════════╗'), true)
})

test('empty spacer lines without a frame do not reserve obstacle area', () => {
  assert.equal(isSubPageObstacleLine(''), false)
  assert.equal(isSubPageObstacleLine('     '), false)
})

test('background cells above a text line are blocked even when their centers miss it', () => {
  // Measured About line bounds at 1728x1117 and 1920x1200.
  for (const [cellY, textY, textHeight] of [[324, 336, 12], [342, 359, 13]] as const) {
    const rect = { x: 900, y: textY, width: 600, height: textHeight }
    assert.ok(cellY + 9 <= rect.y - 2)
    assert.equal(asciiCellOverlapsObstacle(950, cellY, 11.8, 18, rect, 12, 2), true)
  }
})

test('background cells are blocked at text edges while separated cells remain visible', () => {
  const rect = { x: 100, y: 100, width: 100, height: 12 }
  assert.equal(asciiCellOverlapsObstacle(150, 111, 11.8, 18, rect, 12, 2), true)
  assert.equal(asciiCellOverlapsObstacle(211, 100, 11.8, 18, rect, 12, 2), true)
  assert.equal(asciiCellOverlapsObstacle(150, 114, 11.8, 18, rect, 12, 2), false)
  assert.equal(asciiCellOverlapsObstacle(212, 100, 11.8, 18, rect, 12, 2), false)
})
