import { prepareWithSegments, layoutNextLine, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import type { EffectManager } from './EffectManager'
import gsap from 'gsap'

export class LayoutManager {
  // ========== 主页 Dynamic Layout ==========
  private readonly BODY_COPY: string
  private readonly FONT = '18px "Courier New", "DinkieBitmap 9px", Courier, monospace'
  private readonly preparedBody: PreparedTextWithSegments

  private readonly TITLE_LINES = [
    ' _______  _______  __    _  _______        ___   _______         _______        ______   _______  __   __ ',
    '|       ||       ||  |  | ||       |      |   | |       |       |   _   |      |      | |       ||  | |  |',
    '|____   ||    ___||   |_| ||   _   |      |   | |  _____| ____  |  |_|  |      |  _    ||    ___||  |_|  |',
    ' ____|  ||   |___ |       ||  | |  |      |   | | |_____ |____| |       |      | | |   ||   |___ |       |',
    '| ______||    ___||  _    ||  |_|  | ___  |   | |_____  |       |       | ___  | |_|   ||    ___||       |',
    '| |_____ |   |___ | | |   ||       ||   | |   |  _____| |       |   _   ||   | |       ||   |___  |     | ',
    '|_______||_______||_|  |__||_______||___| |___| |_______|       |__| |__||___| |______| |_______|  |___|  ',
  ]
  private readonly TITLE_LETTER_SPACINGS: string[]
  private readonly TITLE_COLOR = '#595959'
  private readonly HEADLINE_FONT_FAMILY = "'Courier New', Courier, monospace"

  private currentTitleFontSize = 0
  private titleLineHeight = 0
  private lastWindowWidth = 0

  // DOM element pools - 主页
  private titleLinesPool: HTMLDivElement[] = []
  private textLinesPool: HTMLDivElement[] = []

  // 2D canvas for text measurement
  private textMaskCtx: CanvasRenderingContext2D

  // ========== About 布局 (Dynamic) ==========
  private readonly ABOUT_LOGO = [
    ' _______  _______  __    _  _______        ___   _______         _______        ______   _______  __   __ ',
    '|       ||       ||  |  | ||       |      |   | |       |       |   _   |      |      | |       ||  | |  |',
    '|____   ||    ___||   |_| ||   _   |      |   | |  _____| ____  |  |_|  |      |  _    ||    ___||  |_|  |',
    ' ____|  ||   |___ |       ||  | |  |      |   | | |_____ |____| |       |      | | |   ||   |___ |       |',
    '| ______||    ___||  _    ||  |_|  | ___  |   | |_____  |       |       | ___  | |_|   ||    ___||       |',
    '| |_____ |   |___ | | |   ||       ||   | |   |  _____| |       |   _   ||   | |       ||   |___  |     | ',
    '|_______||_______||_|  |__||_______||___| |___| |_______|       |__| |__||___| |______| |_______|  |___|  ',
  ]
  private readonly ABOUT_CONTENT = [
    "",
    "> Hi, I'm Zeno.",
    "",
    "  I am a student majoring in Intelligent Science and Technology at Southwest University.",
    "  Currently, I am honing my skills in front-end development with the ultimate goal",
    "  of becoming a professional Front-end or Full-stack Software Engineer.",
    "",
    "  I built this website to serve as more than just a digital business card. Like many creators,",
    "  I wanted a dedicated space to curate my projects and push the boundaries of my potential.",
    "",
    "  Moving forward, I plan to launch a technical blog here to share my insights and journey",
    "  through various tech stacks.",
    "",
    "> My tech stacks:",
  ]
  private aboutContainer: HTMLDivElement | null = null
  private aboutLinesPool: HTMLDivElement[] = []

  // ========== Badges ==========
  private readonly BADGE_URLS = [
    'https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff',
    'https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000',
    'https://img.shields.io/badge/C-00599C?logo=c&logoColor=white',
    'https://img.shields.io/badge/Java-%23ED8B00.svg?logo=openjdk&logoColor=white',
    'https://img.shields.io/badge/Vue.js-4FC08D?logo=vuedotjs&logoColor=fff',
    'https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB',
    'https://img.shields.io/badge/Three.js-000?logo=threedotjs&logoColor=fff',
    'https://img.shields.io/badge/WebGL-990000?logo=webgl&logoColor=white',
    'https://img.shields.io/badge/Node.js-6DA55F?logo=node.js&logoColor=white',
    'https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white',
  ]
  private badgeContainer: HTMLDivElement | null = null
  // "My tech stacks:" 所在行的索引（0-based），badges 从其下一行开始渲染
  private readonly BADGE_ANCHOR_LINE_INDEX = 25 // '> My tech stacks:' line

  /**
   * 主页文字可见度：0 = 全部空格，1 = 正常显示。
   * 转场时由 GSAP 驱动，每帧随 update() 一起应用。
   */
  private homeVisibility = 1.0
  private homeVisibilityTween: gsap.core.Tween | null = null

  /**
   * 为主页文字缓存的固定随机阈值。
   * Key = 元素索引, Value = 每个字符的阈值数组。
   * 仅在动画开始时（消散/重现）重新生成，确保动画期间每个字符的阈值稳定。
   */
  private homeCharThresholds: Map<number, number[]> = new Map()

  constructor() {
    this.BODY_COPY = "My name is zeno, and this is my personal website. I used three.js and pretext to build this website, just wanna let u know if u are interested in it! I'm currently learning the front-end tech stack and aspire to become a front-end engineer! ".repeat(7)
    this.preparedBody = prepareWithSegments(this.BODY_COPY, this.FONT)
    this.TITLE_LETTER_SPACINGS = this.TITLE_LINES.map(() => '0px')

    const textMaskCanvas = document.createElement('canvas')
    textMaskCanvas.width = 256
    textMaskCanvas.height = 256
    this.textMaskCtx = textMaskCanvas.getContext('2d', { willReadFrequently: true })!
  }

  // ========== 主页布局 ==========

  /** 对字符串应用可见度效果（使用缓存的固定阈值） */
  private applyVisibility(text: string, visibility: number, elementIndex: number): string {
    if (visibility >= 1.0) return text
    if (visibility <= 0.0) return ' '.repeat(text.length)

    // 获取或生成此元素的固定阈值
    let thresholds = this.homeCharThresholds.get(elementIndex)
    if (!thresholds || thresholds.length !== text.length) {
      thresholds = []
      for (let c = 0; c < text.length; c++) {
        thresholds.push(Math.random() * 0.6 + 0.15)
      }
      this.homeCharThresholds.set(elementIndex, thresholds)
    }

    let result = ''
    for (let c = 0; c < text.length; c++) {
      result += visibility > thresholds[c]! ? text[c] : ' '
    }
    return result
  }

  /** 每帧更新主页动态布局 - 保留原始实现的所有逻辑 */
  update(
    dynamicLayoutContainer: HTMLDivElement,
    navContainer: HTMLDivElement | null,
    effectManager: EffectManager,
  ) {
    // 1. Title Dimensions Update
    const titleRightSpace = window.innerWidth < 768 ? 20 : 40
    const maxLineLen = Math.max(...this.TITLE_LINES.map((l) => l.length))
    const availableWidth = Math.max(200, window.innerWidth / 2 - titleRightSpace - 20)
    const targetFontSize = Math.max(6, Math.min(16, Math.floor(availableWidth / (maxLineLen * 0.6))))
    if (this.currentTitleFontSize !== targetFontSize || window.innerWidth !== this.lastWindowWidth) {
      this.currentTitleFontSize = targetFontSize
      this.lastWindowWidth = window.innerWidth
    }
    this.titleLineHeight = this.currentTitleFontSize

    // 2. Setup Title DOM Blocks and Measure Bounding Boxes
    while (this.titleLinesPool.length < this.TITLE_LINES.length) {
      const el = document.createElement('div')
      el.className = 'dynamic-title'
      el.style.position = 'absolute'
      el.style.color = this.TITLE_COLOR
      el.style.pointerEvents = 'none'
      el.style.whiteSpace = 'pre'
      el.style.textAlign = 'right'
      dynamicLayoutContainer.appendChild(el)
      this.titleLinesPool.push(el)
    }

    this.textMaskCtx.font = `${this.currentTitleFontSize}px ${this.HEADLINE_FONT_FAMILY}`

    let currentTitleY = 40
    const titleRects: { top: number; bottom: number; left: number; right: number }[] = []

    for (let i = 0; i < this.TITLE_LINES.length; i++) {
      const el = this.titleLinesPool[i]!
      const spacing = this.TITLE_LETTER_SPACINGS[i] || '0px'

      el.textContent = this.applyVisibility(this.TITLE_LINES[i]!, this.homeVisibility, i)
      el.style.right = `${titleRightSpace}px`
      el.style.top = `${currentTitleY}px`
      el.style.font = `${this.currentTitleFontSize}px ${this.HEADLINE_FONT_FAMILY}`
      el.style.lineHeight = `${this.titleLineHeight}px`
      el.style.letterSpacing = spacing

      this.textMaskCtx.letterSpacing = spacing
      const metrics = this.textMaskCtx.measureText(this.TITLE_LINES[i]!)
      const textWidth = metrics.width
      titleRects.push({
        top: currentTitleY,
        bottom: currentTitleY + this.titleLineHeight,
        left: window.innerWidth - titleRightSpace - textWidth,
        right: window.innerWidth - titleRightSpace,
      })

      currentTitleY += this.titleLineHeight
    }

    // 3. Layout Body dynamically dodging boundaries
    const region = {
      x: window.innerWidth / 2 + 20,
      y: 60,
      width: Math.max(0, window.innerWidth / 2 - 40),
      height: Math.max(0, window.innerHeight - 100),
    }
    const lineHeight = 18
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let lineTop = region.y
    const linesData = []

    while (lineTop + lineHeight <= region.y + region.height) {
      let slotLeft = region.x
      let currentSlotRight = window.innerWidth - titleRightSpace - 20

      const limits = effectManager.getObstacleLimits(lineTop, lineHeight)
      if (limits.modelRight > 0) {
        const padding = 20
        slotLeft = Math.max(slotLeft, limits.modelRight + padding)
      }

      // Dodge Title Bounding Boxes
      for (const tb of titleRects) {
        if (lineTop + lineHeight > tb.top && lineTop < tb.bottom) {
          const titlePadding = 48
          currentSlotRight = Math.min(currentSlotRight, tb.left - titlePadding)
        }
      }

      const width = currentSlotRight - slotLeft
      if (width > 0) {
        const line = layoutNextLine(this.preparedBody, cursor, width)
        if (line !== null) {
          linesData.push({ x: slotLeft, y: lineTop, text: line.text })
          cursor = line.end
        } else {
          break
        }
      }

      lineTop += lineHeight
    }

    // Nav positioning
    if (navContainer) {
      if (window.innerWidth < 768) {
        const navPadding = 20
        navContainer.style.left = `${navPadding}px`
        navContainer.style.width = `${window.innerWidth / 2 - navPadding * 2}px`
      } else {
        const slotLeft = window.innerWidth / 2 + 20
        const rightWidth = Math.max(0, window.innerWidth - titleRightSpace - slotLeft)
        navContainer.style.left = `${slotLeft}px`
        navContainer.style.width = `${rightWidth}px`
      }
      navContainer.style.flexDirection = window.innerWidth < 638 ? 'column' : 'row'
    }

    // Body text DOM pool management
    while (this.textLinesPool.length < linesData.length) {
      const el = document.createElement('div')
      el.className = 'dynamic-line'
      el.style.position = 'absolute'
      el.style.font = this.FONT
      el.style.lineHeight = `${lineHeight}px`
      el.style.color = 'rgba(0, 0, 0, 0.65)'
      el.style.letterSpacing = '1px'
      el.style.pointerEvents = 'none'
      el.style.whiteSpace = 'pre'
      dynamicLayoutContainer.appendChild(el)
      this.textLinesPool.push(el)
    }
    while (this.textLinesPool.length > linesData.length) {
      const el = this.textLinesPool.pop()!
      el.remove()
    }
    for (let i = 0; i < linesData.length; i++) {
      const data = linesData[i]
      const el = this.textLinesPool[i]
      if (el && data) {
        el.textContent = this.applyVisibility(data.text, this.homeVisibility, 1000 + i)
        el.style.left = `${data.x}px`
        el.style.top = `${data.y}px`
      }
    }
  }

  // ========== About 布局（预格式化 ASCII Art，右对齐） ==========

  /** 获取 About 所有活跃的文字 DOM 元素 */
  getAboutElements(): HTMLDivElement[] {
    return [...this.aboutLinesPool]
  }

  /** 获取 About 所有活跃的文字内容 */
  getAboutTexts(): string[] {
    return this.aboutLinesPool.map((el) => el.textContent || '')
  }

  /**
   * 渲染 About 页 — 动态适配边框
   */
  updateAbout(
    dynamicLayoutContainer: HTMLDivElement,
    _effectManager: EffectManager,
  ) {
    const rightMargin = window.innerWidth < 768 ? 20 : 60
    const allLines = [...this.ABOUT_LOGO, ...this.ABOUT_CONTENT]
    
    // 找到文字部分最长行的字符数
    const maxLineLen = Math.max(...allLines.map((l) => l.length))
    
    // 计算可用宽度（屏幕右半侧，有一定边距）
    const availableWidth = Math.min(680, Math.max(300, window.innerWidth * 0.5 - rightMargin))
    
    // 等宽字体适应宽度
    const targetFontSize = Math.max(8, Math.min(14, Math.floor(availableWidth / (maxLineLen * 0.58))))
    const lineHeight = targetFontSize * 1.15
    const fontStr = `${targetFontSize}px ${this.HEADLINE_FONT_FAMILY}`

    if (!this.aboutContainer) {
      this.aboutContainer = document.createElement('div')
      this.aboutContainer.className = 'about-container'
      this.aboutContainer.style.position = 'absolute'
      this.aboutContainer.style.border = '1px solid #000'
      this.aboutContainer.style.background = '#fff'
      this.aboutContainer.style.padding = `${targetFontSize * 1.5}px`
      this.aboutContainer.style.boxShadow = '4px 4px 0px rgba(0,0,0,0.1)'
      this.aboutContainer.style.display = 'flex'
      this.aboutContainer.style.flexDirection = 'column'
      this.aboutContainer.style.pointerEvents = 'none'
      dynamicLayoutContainer.appendChild(this.aboutContainer)
    }

    // 更新容器样式 (响应式)
    this.aboutContainer.style.right = `${rightMargin}px`
    this.aboutContainer.style.width = `${availableWidth}px`
    this.aboutContainer.style.padding = `${targetFontSize * 1.5}px`
    
    // 垂直居中
    const totalContentHeight = allLines.length * lineHeight + 40 // 40 为预估 badge 空间
    const startY = Math.max(40, Math.floor((window.innerHeight - totalContentHeight) / 2))
    this.aboutContainer.style.top = `${startY}px`

    // DOM pool management for lines inside container
    while (this.aboutLinesPool.length < allLines.length) {
      const el = document.createElement('div')
      el.className = 'dynamic-line about-line'
      el.style.color = 'rgba(0, 0, 0, 0.75)'
      el.style.whiteSpace = 'pre'
      el.style.minHeight = `${lineHeight}px`
      this.aboutContainer.appendChild(el)
      this.aboutLinesPool.push(el)
    }
    while (this.aboutLinesPool.length > allLines.length) {
      const el = this.aboutLinesPool.pop()!
      el.remove()
    }

    for (let i = 0; i < allLines.length; i++) {
      const el = this.aboutLinesPool[i]!
      el.textContent = allLines[i]!
      el.style.font = fontStr
      el.style.lineHeight = `${lineHeight}px`
    }

    // ---- Badges ----
    if (!this.badgeContainer) {
      this.badgeContainer = document.createElement('div')
      this.badgeContainer.className = 'about-badges'
      this.badgeContainer.style.marginTop = '12px'
      this.badgeContainer.style.display = 'flex'
      this.badgeContainer.style.flexWrap = 'wrap'
      this.badgeContainer.style.gap = '6px'
      this.badgeContainer.style.alignItems = 'center'
      this.badgeContainer.style.paddingLeft = `${targetFontSize * 1.5}px`
      this.aboutContainer.appendChild(this.badgeContainer)

      for (const url of this.BADGE_URLS) {
        const img = document.createElement('img')
        img.src = url
        img.style.height = `20px`
        img.draggable = false
        this.badgeContainer.appendChild(img)
      }
    }

    // 更新 badge 图片高度
    const badgeImgHeight = Math.max(16, targetFontSize * 1.8)
    const imgs = this.badgeContainer.querySelectorAll('img')
    imgs.forEach((img) => {
      ;(img as HTMLImageElement).style.height = `${badgeImgHeight}px`
    })
  }

  /** 获取 badge 容器元素（用于动画） */
  getBadgeContainer(): HTMLDivElement | null {
    return this.badgeContainer
  }

  /** 获取 About 页面的所有文本块区域，用于 ASCII 规避 */
  getAboutRects(): { x: number; y: number; width: number; height: number }[] {
    const rects: { x: number; y: number; width: number; height: number }[] = []

    // 1. 文字行避让（精确到每一行，避免大块空白区域也被避让）
    for (let i = 0; i < this.aboutLinesPool.length; i++) {
      const el = this.aboutLinesPool[i]!
      const lineText = this.ABOUT_LINES[i]!
      
      // 跳过纯空行，减少计算量并允许背景穿透
      if (lineText.trim() === '║' || lineText.trim() === '') continue

      // 计算该行的精确像素宽度
      this.textMaskCtx.font = el.style.font
      const lineWidth = this.textMaskCtx.measureText(lineText).width
      const rightMargin = parseFloat(el.style.right) || 0
      
      // 计算该行相对于屏幕左侧的 X 坐标
      const x = window.innerWidth - rightMargin - lineWidth

      rects.push({
        x: x,
        y: parseFloat(el.style.top),
        width: lineWidth,
        height: parseFloat(el.style.lineHeight) || 16,
      })
    }

    // 2. Badge 容器避让
    if (this.badgeContainer) {
      rects.push({
        x: parseFloat(this.badgeContainer.style.left),
        y: parseFloat(this.badgeContainer.style.top),
        width: parseFloat(this.badgeContainer.style.width),
        height: this.badgeContainer.offsetHeight || 40,
      })
    }

    return rects
  }

  /** 清除 About 的 DOM 元素 */
  clearAbout() {
    for (const el of this.aboutLinesPool) {
      el.remove()
    }
    this.aboutLinesPool = []

    if (this.badgeContainer) {
      this.badgeContainer.remove()
      this.badgeContainer = null
    }
  }

  /**
   * 主页文字消散动画：可见度从 1 → 0
   * 在动画期间 update() 每帧仍运行，自动应用效果
   */
  animateHomeDissolve(duration = 1.0): Promise<void> {
    this.killHomeTween()
    // 动画开始时重新生成阈值，使每次消散的波前图案不同
    this.homeCharThresholds.clear()
    return new Promise((resolve) => {
      this.homeVisibilityTween = gsap.to(this, {
        homeVisibility: 0,
        duration,
        ease: 'power3.in',
        onComplete: () => {
          this.homeVisibilityTween = null
          resolve()
        },
      })
    })
  }

  /**
   * 主页文字重现动画：可见度从 0 → 1
   * 在动画期间 update() 每帧仍运行，自动应用效果
   */
  animateHomeMaterialize(duration = 1.0): Promise<void> {
    this.killHomeTween()
    this.homeVisibility = 0
    // 动画开始时重新生成阈值，使每次重现的波前图案不同
    this.homeCharThresholds.clear()
    return new Promise((resolve) => {
      this.homeVisibilityTween = gsap.to(this, {
        homeVisibility: 1,
        duration,
        ease: 'power3.out',
        onComplete: () => {
          this.homeVisibilityTween = null
          resolve()
        },
      })
    })
  }

  /** 立即设置主页文字可见度（无动画） */
  setHomeVisibility(v: number) {
    this.killHomeTween()
    this.homeVisibility = v
  }

  private killHomeTween() {
    if (this.homeVisibilityTween) {
      this.homeVisibilityTween.kill()
      this.homeVisibilityTween = null
    }
  }
}
