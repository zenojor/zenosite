import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RENDER_PIXEL_RATIO, clampPixelRatio } from './rendering.ts'

test('clampPixelRatio caps high density screens', () => {
  assert.equal(clampPixelRatio(4), MAX_RENDER_PIXEL_RATIO)
})

test('clampPixelRatio keeps low and invalid values usable', () => {
  assert.equal(clampPixelRatio(1.25), 1.25)
  assert.equal(clampPixelRatio(0), 1)
  assert.equal(clampPixelRatio(Number.NaN), 1)
})
