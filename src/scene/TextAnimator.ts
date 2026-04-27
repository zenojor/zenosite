import gsap from 'gsap'

/**
 * 通用的"字符消散/重现"动画器。
 * 每个字符有一个预先分配的固定阈值，按波前顺序消散/重现，避免每帧随机闪烁。
 */
export class TextAnimator {
  /**
   * 为每行文字预生成随机阈值数组（每个字符一个固定阈值）
   */
  private static buildThresholds(lengths: number[]): number[][] {
    return lengths.map((len) => {
      const thresholds: number[] = []
      for (let c = 0; c < len; c++) {
        thresholds.push(Math.random() * 0.6 + 0.15) // 0.15~0.75 范围更宽，过渡更自然
      }
      return thresholds
    })
  }

  /**
   * 消散动画：字符按固定阈值逐个变为空格直到完全消失
   */
  static dissolve(elements: HTMLDivElement[], duration = 1.0): Promise<void> {
    if (elements.length === 0) return Promise.resolve()

    const originalTexts = elements.map((el) => el.textContent || '')
    const thresholds = this.buildThresholds(originalTexts.map((t) => t.length))

    return new Promise((resolve) => {
      const state = { progress: 0 }

      gsap.to(state, {
        progress: 1,
        duration,
        ease: 'power3.in',
        onUpdate: () => {
          const p = state.progress
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i]!
            const original = originalTexts[i]!
            const charThresholds = thresholds[i]!
            let result = ''
            for (let c = 0; c < original.length; c++) {
              result += p > charThresholds[c]! ? ' ' : original[c]
            }
            el.textContent = result
          }
        },
        onComplete: () => {
          for (const el of elements) {
            el.textContent = ''
            el.style.display = 'none'
          }
          resolve()
        },
      })
    })
  }

  /**
   * 重现动画：空格按固定阈值逐个变为目标字符
   */
  static materialize(
    elements: HTMLDivElement[],
    texts: string[],
    duration = 1.0,
  ): Promise<void> {
    if (elements.length === 0) return Promise.resolve()

    const thresholds = this.buildThresholds(texts.map((t) => t.length))

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]!
      el.style.display = ''
      el.textContent = ' '.repeat(texts[i]?.length || 0)
    }

    return new Promise((resolve) => {
      const state = { progress: 0 }

      gsap.to(state, {
        progress: 1,
        duration,
        ease: 'power3.out',
        onUpdate: () => {
          const p = state.progress
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i]!
            const target = texts[i] || ''
            const charThresholds = thresholds[i]!
            let result = ''
            for (let c = 0; c < target.length; c++) {
              result += p > charThresholds[c]! ? target[c] : ' '
            }
            el.textContent = result
          }
        },
        onComplete: () => {
          for (let i = 0; i < elements.length; i++) {
            elements[i]!.textContent = texts[i] || ''
          }
          resolve()
        },
      })
    })
  }
}
