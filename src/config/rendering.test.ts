import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RENDER_PIXEL_RATIO, MAX_REFLECTION_SIZE, clampPixelRatio, getReflectionSize } from './rendering.ts'

test('clampPixelRatio caps high density screens', () => {
  assert.equal(clampPixelRatio(4), MAX_RENDER_PIXEL_RATIO)
})

test('clampPixelRatio keeps low and invalid values usable', () => {
  assert.equal(clampPixelRatio(1.25), 1.25)
  assert.equal(clampPixelRatio(0), 1)
  assert.equal(clampPixelRatio(Number.NaN), 1)
})

test('reflection uses a smaller target while preserving viewport proportions', () => {
  assert.deepEqual(getReflectionSize(1280, 720), { width: 960, height: 540 })
  assert.deepEqual(getReflectionSize(720, 1280), { width: 540, height: 960 })
})

test('reflection size is bounded on large and collapsed viewports', () => {
  const size = getReflectionSize(3840, 2160)
  assert.equal(size.width, MAX_REFLECTION_SIZE)
  assert.equal(size.height, 576)
  assert.deepEqual(getReflectionSize(0, 0), { width: 1, height: 1 })
})
