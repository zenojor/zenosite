import gsap from 'gsap'
import { TransitionController } from './TransitionController'
import { setText } from './dom/updates'

/** Character and badge animations owned by one scene runtime. */
export class TextAnimator {
  private readonly transitions = new Set<TransitionController>()

  private buildThresholds(lengths: number[]): number[][] {
    return lengths.map(length => Array.from({ length }, () => Math.random() * 0.6 + 0.15))
  }

  private tween(target: gsap.TweenTarget, vars: gsap.TweenVars): Promise<void> {
    return new Promise((resolve, reject) => {
      const controller = new TransitionController()
      this.transitions.add(controller)
      const tween = gsap.to(target, {
        ...vars,
        onComplete: () => {
          vars.onComplete?.()
          controller.complete()
        },
      })
      controller.track([tween], () => {
        this.transitions.delete(controller)
        resolve()
      }, error => {
        this.transitions.delete(controller)
        reject(error)
      })
    })
  }

  cancel() {
    for (const controller of this.transitions) controller.cancel()
  }

  dissolve(elements: HTMLElement[], duration = 1.0): Promise<void> {
    if (elements.length === 0) return Promise.resolve()
    const originalTexts = elements.map(el => el.textContent || '')
    const thresholds = this.buildThresholds(originalTexts.map(text => text.length))
    const state = { progress: 0 }

    return this.tween(state, {
      progress: 1,
      duration,
      ease: 'power3.in',
      onUpdate: () => {
        for (let i = 0; i < elements.length; i++) {
          const original = originalTexts[i]!
          let result = ''
          for (let c = 0; c < original.length; c++) {
            result += state.progress > thresholds[i]![c]! ? ' ' : original[c]
          }
          setText(elements[i]!, result)
        }
      },
      onComplete: () => {
        for (const el of elements) {
          el.textContent = ''
          el.style.display = 'none'
        }
      },
    })
  }

  materialize(elements: HTMLElement[], texts: string[], duration = 1.0): Promise<void> {
    if (elements.length === 0) return Promise.resolve()
    const thresholds = this.buildThresholds(texts.map(text => text.length))
    for (let i = 0; i < elements.length; i++) {
      elements[i]!.style.display = ''
      elements[i]!.textContent = ' '.repeat(texts[i]?.length || 0)
    }
    const state = { progress: 0 }

    return this.tween(state, {
      progress: 1,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        for (let i = 0; i < elements.length; i++) {
          const target = texts[i] || ''
          let result = ''
          for (let c = 0; c < target.length; c++) {
            result += state.progress > thresholds[i]![c]! ? target[c] : ' '
          }
          setText(elements[i]!, result)
        }
      },
      onComplete: () => {
        for (let i = 0; i < elements.length; i++) setText(elements[i]!, texts[i] || '')
      },
    })
  }

  fade(element: HTMLElement, opacity: number, duration = 0.8, ease = 'power3.out') {
    return this.tween(element, { opacity, duration, ease })
  }
}
