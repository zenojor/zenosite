import assert from 'node:assert/strict'
import test from 'node:test'
import { TransitionCancelledError, TransitionController, type KillableTween } from './TransitionController.ts'

test('cancel kills active tweens and rejects the pending transition', async () => {
  const killed: string[] = []
  const controller = new TransitionController()
  const tween: KillableTween = { kill: () => killed.push('tween') }

  const transition = new Promise<void>((resolve, reject) => {
    controller.track([tween], resolve, reject)
  })

  controller.cancel()

  await assert.rejects(transition, TransitionCancelledError)
  assert.deepEqual(killed, ['tween'])
})

test('complete resolves the pending transition without killing tweens', async () => {
  const killed: string[] = []
  const controller = new TransitionController()
  const tween: KillableTween = { kill: () => killed.push('tween') }

  const transition = new Promise<void>((resolve, reject) => {
    controller.track([tween], resolve, reject)
  })

  controller.complete()

  await transition
  assert.deepEqual(killed, [])
})
