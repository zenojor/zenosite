import assert from 'node:assert/strict'
import test from 'node:test'
import { fitSubPageFontSize, getScrollViewport } from './layoutSizing.ts'

test('static content keeps its width-based size when height is sufficient', () => {
  assert.equal(fitSubPageFontSize(13, 6, 720, 37), 13)
})

test('wide short windows fit static content vertically', () => {
  assert.equal(fitSubPageFontSize(13, 6, 390, 37), 9)
  assert.equal(fitSubPageFontSize(16, 6, 160, 9, 0.145), 8)
})

test('minimum font size is preserved so overflow can scroll', () => {
  assert.equal(fitSubPageFontSize(13, 6, 160, 37), 6)
})

test('scroll viewports retain desktop margins and fit short windows', () => {
  assert.deepEqual(getScrollViewport(720), { top: 80, height: 540 })
  assert.deepEqual(getScrollViewport(160), { top: 24, height: 104 })
  for (const height of [100, 160, 240, 390, 720, 1080]) {
    const pane = getScrollViewport(height)
    assert.ok(pane.height > 0)
    assert.ok(pane.top + pane.height <= height)
  }
})
