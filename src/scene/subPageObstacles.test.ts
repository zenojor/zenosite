import assert from 'node:assert/strict'
import test from 'node:test'
import { isSubPageObstacleLine } from './subPageObstacles.ts'

test('subpage frame-only lines still reserve the content box area', () => {
  assert.equal(isSubPageObstacleLine('║                                                                 ║'), true)
  assert.equal(isSubPageObstacleLine('╔═════════════════════════════════════════════════════════════════╗'), true)
})

test('empty spacer lines without a frame do not reserve obstacle area', () => {
  assert.equal(isSubPageObstacleLine(''), false)
  assert.equal(isSubPageObstacleLine('     '), false)
})
