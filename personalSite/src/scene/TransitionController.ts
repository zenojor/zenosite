export interface KillableTween {
  kill(): void
}

export class TransitionCancelledError extends Error {
  constructor() {
    super('Transition was cancelled')
    this.name = 'TransitionCancelledError'
  }
}

export function isTransitionCancelled(error: unknown): error is TransitionCancelledError {
  return error instanceof TransitionCancelledError
}

export class TransitionController {
  private tweens: KillableTween[] = []
  private resolve: (() => void) | null = null
  private reject: ((error: unknown) => void) | null = null

  track(tweens: KillableTween[], resolve: () => void, reject: (error: unknown) => void) {
    this.cancel()
    this.tweens = tweens
    this.resolve = resolve
    this.reject = reject
  }

  complete() {
    const resolve = this.resolve
    this.clear()
    resolve?.()
  }

  cancel() {
    const tweens = this.tweens
    const reject = this.reject
    this.clear()

    for (const tween of tweens) {
      tween.kill()
    }

    reject?.(new TransitionCancelledError())
  }

  private clear() {
    this.tweens = []
    this.resolve = null
    this.reject = null
  }
}
