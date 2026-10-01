import assert from 'node:assert/strict'
import test from 'node:test'
import { completeSentencePrefix } from './homeBodyFlow.ts'

test('sentence selection ignores a wrapped dot inside three.js', () => {
  const text = 'This is my website. I used three.js to build it! Next sentence.'
  assert.equal(completeSentencePrefix(text, text.indexOf('three.') + 6), 'This is my website.')
  assert.equal(completeSentencePrefix(text, text.indexOf('Next')), 'This is my website. I used three.js to build it!')
})
