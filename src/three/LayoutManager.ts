import { prepareWithSegments, layoutNextLine, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import type { EffectManager } from './EffectManager'
import { SITE_CONTENT, type SubPageContent, type SocialBadge } from '../state/siteContent'
import type { PageName } from '../state/siteState'
import gsap from 'gsap'
import { BREAKPOINTS, HOME_LAYOUT, SUB_PAGE_LAYOUT, responsive } from '../state/siteConfig'

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
  private get TITLE_COLOR() { return HOME_LAYOUT.title.color }
  private readonly HEADLINE_FONT_FAMILY = "'Courier New', Courier, monospace"

  private currentTitleFontSize = 0
  private titleLineHeight = 0
  private lastWindowWidth = 0

  // DOM element pools - 主页
  private titleLinesPool: HTMLDivElement[] = []
  private textLinesPool: HTMLDivElement[] = []

  // 2D canvas for text measurement
  private textMaskCtx: CanvasRenderingContext2D

  // ========== SubPage 布局（预格式化 ASCII Art） ==========
  private currentSubPageContent: SubPageContent | null = null
  private subPageLinesPool: HTMLDivElement[] = []

  // ========== Scrollable container ==========
  private scrollContainer: HTMLDivElement | null = null
  private scrollInnerWrapper: HTMLDivElement | null = null

  // ========== Badges ==========
  private badgeContainer: HTMLDivElement | null = null
  private socialBadgeContainer: HTMLDivElement | null = null
  private copyToast: HTMLDivElement | null = null

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
    const titleRightSpace = responsive(HOME_LAYOUT.title.rightSpace)
    const maxLineLen = Math.max(...this.TITLE_LINES.map((l) => l.length))
    const availableWidth = Math.max(200, window.innerWidth / 2 - titleRightSpace - 20)
    const targetFontSize = Math.max(HOME_LAYOUT.title.minFontSize, Math.min(HOME_LAYOUT.title.maxFontSize, Math.floor(availableWidth / (maxLineLen * 0.6))))
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

    let currentTitleY = HOME_LAYOUT.title.startY
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
      x: window.innerWidth / 2 + HOME_LAYOUT.body.xOffset,
      y: HOME_LAYOUT.body.yStart,
      width: Math.max(0, window.innerWidth / 2 - HOME_LAYOUT.body.rightPadding),
      height: Math.max(0, window.innerHeight - HOME_LAYOUT.body.bottomPadding),
    }
    const lineHeight = HOME_LAYOUT.body.lineHeight
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let lineTop = region.y
    const linesData = []

    while (lineTop + lineHeight <= region.y + region.height) {
      let slotLeft = region.x
      let currentSlotRight = window.innerWidth - titleRightSpace - 20

      const limits = effectManager.getObstacleLimits(lineTop, lineHeight)
      if (limits.modelRight > 0) {
        slotLeft = Math.max(slotLeft, limits.modelRight + HOME_LAYOUT.body.modelDodgePadding)
      }

      // Dodge Title Bounding Boxes
      for (const tb of titleRects) {
        if (lineTop + lineHeight > tb.top && lineTop < tb.bottom) {
          currentSlotRight = Math.min(currentSlotRight, tb.left - HOME_LAYOUT.body.titleDodgePadding)
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
      if (window.innerWidth < BREAKPOINTS.mobile) {
        const navPadding = HOME_LAYOUT.nav.mobilePadding
        navContainer.style.left = `${navPadding}px`
        navContainer.style.width = `${window.innerWidth / 2 - navPadding * 2}px`
      } else {
        const slotLeft = window.innerWidth / 2 + HOME_LAYOUT.nav.desktopXOffset
        const rightWidth = Math.max(0, window.innerWidth - titleRightSpace - slotLeft)
        navContainer.style.left = `${slotLeft}px`
        navContainer.style.width = `${rightWidth}px`
      }
      navContainer.style.flexDirection = window.innerWidth < BREAKPOINTS.smallMobile ? 'column' : 'row'
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

  // ========== SubPage 布局（预格式化 ASCII Art，右对齐） ==========

  /** 获取 SubPage 所有活跃的文字 DOM 元素 */
  getSubPageElements(): HTMLDivElement[] {
    return [...this.subPageLinesPool]
  }

  /** 获取 SubPage 所有活跃的文字内容 */
  getSubPageTexts(): string[] {
    return this.subPageLinesPool.map((el) => el.textContent || '')
  }

  /**
   * 渲染子页面 — 预格式化 ASCII Art 框，右对齐。
   * 自动计算字号使最长行恰好填满可用区域。
   */
  updateSubPage(
    pageName: Exclude<PageName, 'home'>,
    dynamicLayoutContainer: HTMLDivElement,
    _effectManager: EffectManager,
  ) {
    const content = SITE_CONTENT[pageName]
    if (!content) return
    this.currentSubPageContent = content

    const pageConfig = SUB_PAGE_LAYOUT[pageName]
    const rightMargin = responsive(pageConfig.rightMargin)
    const leftMargin = responsive(pageConfig.leftMargin)

    // 找到最长行的字符数
    const maxLineLen = Math.max(...content.lines.map((l) => l.length))

    // 计算可用宽度（屏幕右半侧）
    const availableWidth = Math.max(200, window.innerWidth / 2 - rightMargin)

    // 等宽字体：每个字符宽度 ≈ fontSize × 0.6
    const targetFontSize = Math.max(pageConfig.minFontSize, Math.min(pageConfig.maxFontSize, Math.floor(availableWidth / (maxLineLen * 0.6))))
    const lineHeight = targetFontSize // 与主页一致

    // 整体内容高度
    const totalHeight = content.lines.length * lineHeight

    const fontStr = `${targetFontSize}px ${this.HEADLINE_FONT_FAMILY}`

    // ── Scrollable mode ──
    if (content.scrollable) {
      this.updateSubPageScrollable(
        content, pageConfig, dynamicLayoutContainer,
        rightMargin, leftMargin, maxLineLen,
        targetFontSize, lineHeight, totalHeight, fontStr,
      )
      return
    }

    // ── Normal (non-scrollable) mode ──
    // 垂直居中
    let startY = Math.max(20, Math.floor((window.innerHeight - totalHeight) / 2))

    if (pageConfig.verticalOffset > 0) {
      startY += Math.floor(window.innerHeight * pageConfig.verticalOffset)
    }

    // 水平右对齐：从屏幕右边减去 margin
    const rightPos = rightMargin

    // DOM pool management
    while (this.subPageLinesPool.length < content.lines.length) {
      const el = document.createElement('div')
      el.className = 'dynamic-line subpage-line'
      el.style.position = 'absolute'
      el.style.color = 'rgba(0, 0, 0, 0.65)'
      el.style.pointerEvents = 'none'
      el.style.whiteSpace = 'pre'
      el.style.textAlign = 'right'
      dynamicLayoutContainer.appendChild(el)
      this.subPageLinesPool.push(el)
    }
    while (this.subPageLinesPool.length > content.lines.length) {
      const el = this.subPageLinesPool.pop()!
      el.remove()
    }
    for (let i = 0; i < content.lines.length; i++) {
      const el = this.subPageLinesPool[i]!
      el.textContent = content.lines[i]!
      if (pageConfig.textAlign === 'left') {
        el.style.left = `${leftMargin}px`
        el.style.right = ''
        el.style.textAlign = 'left'
      } else {
        el.style.right = `${rightPos}px`
        el.style.left = ''
        el.style.textAlign = 'right'
      }
      el.style.top = `${startY + i * lineHeight}px`
      el.style.font = fontStr
      el.style.lineHeight = `${lineHeight}px`
      el.style.letterSpacing = '0px'
    }

    // ---- Badges ----
    if (content.badges && content.badges.length > 0 && content.badgeAnchorLineIndex !== undefined) {
      // 计算 badge 行的 Y 位置（紧跟 anchor 后一行的空行）
      const badgeLineIndex = content.badgeAnchorLineIndex + 1
      const badgeY = startY + badgeLineIndex * lineHeight + 2

      // 计算文本块右边界的 X 坐标（与文字对齐）
      this.textMaskCtx.font = fontStr
      const sampleLine = content.lines[content.badgeAnchorLineIndex]!
      const textBlockWidth = this.textMaskCtx.measureText(sampleLine).width
      const badgeRight = window.innerWidth - rightMargin
      const badgeStartX = pageConfig.textAlign === 'left'
        ? leftMargin
        : badgeRight - textBlockWidth + targetFontSize * 0.6 * 4 // 缩进 ~4 字符

      if (!this.badgeContainer) {
        this.badgeContainer = document.createElement('div')
        this.badgeContainer.className = 'subpage-badges'
        this.badgeContainer.style.position = 'absolute'
        this.badgeContainer.style.pointerEvents = 'none'
        this.badgeContainer.style.display = 'flex'
        this.badgeContainer.style.flexWrap = 'wrap'
        this.badgeContainer.style.gap = '4px'
        this.badgeContainer.style.alignItems = 'center'
        dynamicLayoutContainer.appendChild(this.badgeContainer)
      }

      // 确保内容同步
      const existingImgs = Array.from(this.badgeContainer.querySelectorAll('img'))
      if (existingImgs.length !== content.badges.length) {
        this.badgeContainer.innerHTML = ''
        for (const url of content.badges) {
          const img = document.createElement('img')
          img.src = url
          img.style.height = `${Math.max(12, lineHeight * 1.3)}px`
          img.style.display = 'block'
          img.draggable = false
          this.badgeContainer.appendChild(img)
        }
      }

      // 更新 badge 容器位置和大小
      const badgeAreaWidth = textBlockWidth - targetFontSize * 0.6 * 8 // 左右各缩进 4 字符
      this.badgeContainer.style.left = `${badgeStartX}px`
      this.badgeContainer.style.top = `${badgeY}px`
      this.badgeContainer.style.width = `${badgeAreaWidth}px`
      this.badgeContainer.style.display = 'flex'

      // 更新 badge 图片高度
      const imgs = this.badgeContainer.querySelectorAll('img')
      imgs.forEach((img) => {
        ; (img as HTMLImageElement).style.height = `${Math.max(12, lineHeight * 1.3)}px`
      })
    } else {
      if (this.badgeContainer) {
        this.badgeContainer.style.display = 'none'
      }
    }

    // ---- Social Badges ----
    if (content.socialBadges && content.socialBadges.length > 0 && content.socialBadgeAnchorLineIndex !== undefined) {
      const socialLineIndex = content.socialBadgeAnchorLineIndex + 1
      const socialY = startY + socialLineIndex * lineHeight + 2

      this.textMaskCtx.font = fontStr
      const socialSampleLine = content.lines[content.socialBadgeAnchorLineIndex]!
      const socialTextBlockWidth = this.textMaskCtx.measureText(socialSampleLine).width
      const socialBadgeRight = window.innerWidth - rightMargin
      const socialBadgeStartX = pageConfig.textAlign === 'left'
        ? leftMargin
        : socialBadgeRight - socialTextBlockWidth + targetFontSize * 0.6 * 4

      if (!this.socialBadgeContainer) {
        this.socialBadgeContainer = document.createElement('div')
        this.socialBadgeContainer.className = 'subpage-social-badges'
        this.socialBadgeContainer.style.position = 'absolute'
        this.socialBadgeContainer.style.pointerEvents = 'auto'
        this.socialBadgeContainer.style.display = 'flex'
        this.socialBadgeContainer.style.flexWrap = 'wrap'
        this.socialBadgeContainer.style.gap = '4px'
        this.socialBadgeContainer.style.alignItems = 'center'
        dynamicLayoutContainer.appendChild(this.socialBadgeContainer)
      }

      // Sync social badge content
      const existingSocialImgs = Array.from(this.socialBadgeContainer.querySelectorAll('img'))
      if (existingSocialImgs.length !== content.socialBadges.length) {
        this.socialBadgeContainer.innerHTML = ''
        for (const badge of content.socialBadges) {
          const wrapper = document.createElement('a')
          wrapper.style.cursor = 'pointer'
          wrapper.style.display = 'inline-block'
          wrapper.style.transition = 'opacity 0.2s ease, transform 0.15s ease'
          wrapper.addEventListener('mouseenter', () => { wrapper.style.opacity = '0.75'; wrapper.style.transform = 'scale(1.05)' })
          wrapper.addEventListener('mouseleave', () => { wrapper.style.opacity = '1'; wrapper.style.transform = 'scale(1)' })

          if (badge.action.type === 'link') {
            wrapper.href = badge.action.url
            wrapper.target = '_blank'
            wrapper.rel = 'noopener noreferrer'
          } else {
            wrapper.addEventListener('click', (e) => {
              e.preventDefault()
              const text = (badge.action as { type: 'copy'; text: string }).text
              navigator.clipboard.writeText(text).then(() => {
                this.showCopyToast(text)
              })
            })
          }

          const img = document.createElement('img')
          img.src = badge.img
          img.style.height = `${Math.max(12, lineHeight * 1.3)}px`
          img.style.display = 'block'
          img.draggable = false
          wrapper.appendChild(img)
          this.socialBadgeContainer.appendChild(wrapper)
        }
      }

      // Position social badge container
      const socialBadgeAreaWidth = socialTextBlockWidth - targetFontSize * 0.6 * 8
      this.socialBadgeContainer.style.left = `${socialBadgeStartX}px`
      this.socialBadgeContainer.style.top = `${socialY}px`
      this.socialBadgeContainer.style.width = `${socialBadgeAreaWidth}px`
      this.socialBadgeContainer.style.display = 'flex'

      // Update social badge img heights
      const socialImgs = this.socialBadgeContainer.querySelectorAll('img')
      socialImgs.forEach((img) => {
        ;(img as HTMLImageElement).style.height = `${Math.max(12, lineHeight * 1.3)}px`
      })
    } else {
      if (this.socialBadgeContainer) {
        this.socialBadgeContainer.style.display = 'none'
      }
    }
  }

  /** 渲染可滚动子页面 — 长内容在固定区域内部滚动 */
  private updateSubPageScrollable(
    content: SubPageContent,
    pageConfig: (typeof SUB_PAGE_LAYOUT)[keyof typeof SUB_PAGE_LAYOUT],
    dynamicLayoutContainer: HTMLDivElement,
    rightMargin: number,
    leftMargin: number,
    maxLineLen: number,
    targetFontSize: number,
    lineHeight: number,
    totalHeight: number,
    fontStr: string,
  ) {
    // Inject scrollbar CSS once
    if (!document.getElementById('subpage-scroll-style')) {
      const style = document.createElement('style')
      style.id = 'subpage-scroll-style'
      style.textContent = `
        .subpage-scroll-container::-webkit-scrollbar {
          width: 4px;
        }
        .subpage-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .subpage-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 2px;
        }
        .subpage-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        .subpage-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.15) transparent;
        }
      `
      document.head.appendChild(style)
    }

    // Container top/bottom margins
    const containerTopMargin = 80
    const containerBottomMargin = 100
    const containerHeight = window.innerHeight - containerTopMargin - containerBottomMargin

    // Create or reuse scroll container
    if (!this.scrollContainer) {
      this.scrollContainer = document.createElement('div')
      this.scrollContainer.className = 'subpage-scroll-container'
      this.scrollContainer.style.position = 'absolute'
      this.scrollContainer.style.overflowY = 'auto'
      this.scrollContainer.style.overflowX = 'hidden'
      this.scrollContainer.style.pointerEvents = 'auto'

      this.scrollInnerWrapper = document.createElement('div')
      this.scrollInnerWrapper.style.position = 'relative'
      this.scrollInnerWrapper.style.display = 'flex'
      this.scrollInnerWrapper.style.flexDirection = 'column'
      this.scrollInnerWrapper.style.width = 'max-content'

      this.scrollContainer.appendChild(this.scrollInnerWrapper)
      dynamicLayoutContainer.appendChild(this.scrollContainer)
    }

    // Position the scroll container
    this.scrollContainer.style.top = `${containerTopMargin}px`
    this.scrollContainer.style.height = `${containerHeight}px`
    this.scrollContainer.style.maxWidth = `${Math.max(200, window.innerWidth / 2 - rightMargin)}px`

    if (pageConfig.textAlign === 'left') {
      this.scrollContainer.style.left = `${leftMargin}px`
      this.scrollContainer.style.right = ''
      this.scrollContainer.style.width = 'auto'
      this.scrollInnerWrapper!.style.alignItems = 'flex-start'
    } else {
      this.scrollContainer.style.right = `${rightMargin}px`
      this.scrollContainer.style.left = ''
      this.scrollContainer.style.width = 'auto'
      this.scrollInnerWrapper!.style.alignItems = 'flex-end'
    }

    // Let content define the horizontal footprint so the block does not feel like a fixed-width column.
    this.scrollInnerWrapper!.style.height = 'auto'

    // DOM pool — lines go inside scrollInnerWrapper
    const parent = this.scrollInnerWrapper!
    while (this.subPageLinesPool.length < content.lines.length) {
      const el = document.createElement('div')
      el.className = 'dynamic-line subpage-line'
      el.style.position = 'relative'
      el.style.display = 'block'
      el.style.color = 'rgba(0, 0, 0, 0.65)'
      el.style.pointerEvents = 'none'
      el.style.whiteSpace = 'pre'
      parent.appendChild(el)
      this.subPageLinesPool.push(el)
    }
    while (this.subPageLinesPool.length > content.lines.length) {
      const el = this.subPageLinesPool.pop()!
      el.remove()
    }
    for (let i = 0; i < content.lines.length; i++) {
      const el = this.subPageLinesPool[i]!
      el.textContent = content.lines[i]!

      if (pageConfig.textAlign === 'left') {
        el.style.textAlign = 'left'
      } else {
        el.style.textAlign = 'right'
      }

      el.style.font = fontStr
      el.style.lineHeight = `${lineHeight}px`
      el.style.letterSpacing = '0px'
      el.style.left = ''
      el.style.right = ''
      el.style.top = ''
      el.style.width = 'max-content'
    }
  }

  /** 显示复制成功的提示 */
  private showCopyToast(text: string) {
    if (!this.copyToast) {
      this.copyToast = document.createElement('div')
      this.copyToast.style.position = 'fixed'
      this.copyToast.style.top = '40px'
      this.copyToast.style.left = '50%'
      this.copyToast.style.transform = 'translateX(-50%)'
      this.copyToast.style.backgroundColor = '#ffffff'
      this.copyToast.style.color = '#595959'
      this.copyToast.style.border = '1px solid #595959'
      this.copyToast.style.padding = '10px 20px'
      this.copyToast.style.fontFamily = "'Courier New', 'DinkieBitmap 9px', Courier, monospace"
      this.copyToast.style.fontSize = '14px'
      this.copyToast.style.fontWeight = 'bold'
      this.copyToast.style.zIndex = '1000'
      this.copyToast.style.pointerEvents = 'none'
      this.copyToast.style.opacity = '0'
      this.copyToast.style.transition = 'opacity 0.3s ease, margin-top 0.3s ease'
      this.copyToast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
      document.body.appendChild(this.copyToast)
    }

    this.copyToast.textContent = `> Copied: ${text}`
    this.copyToast.style.marginTop = '0'
    this.copyToast.style.opacity = '1'

    // 简单的小动画效果
    this.copyToast.style.marginTop = '10px'

    setTimeout(() => {
      if (this.copyToast) {
        this.copyToast.style.opacity = '0'
        this.copyToast.style.marginTop = '0'
      }
    }, 2000)
  }

  /** 获取 badge 容器元素（用于动画） */
  getBadgeContainer(): HTMLDivElement | null {
    return this.badgeContainer
  }

  /** 获取 social badge 容器元素（用于动画） */
  getSocialBadgeContainer(): HTMLDivElement | null {
    return this.socialBadgeContainer
  }

  /** 获取 SubPage 页面的所有文本块区域，用于 ASCII 规避（精确到行） */
  getSubPageRects(): { x: number; y: number; width: number; height: number }[] {
    const rects: { x: number; y: number; width: number; height: number }[] = []
    if (!this.currentSubPageContent) return rects

    // Scrollable mode: dodge only the visible text lines so the ASCII wrap is not a rigid column.
    if (this.scrollContainer) {
      const containerRect = this.scrollContainer.getBoundingClientRect()
      for (let i = 0; i < this.subPageLinesPool.length; i++) {
        const el = this.subPageLinesPool[i]!
        const lineText = this.currentSubPageContent.lines[i]!

        if (lineText.trim() === '鈺?' || lineText.trim() === '') continue

        const domRect = el.getBoundingClientRect()
        const visibleTop = Math.max(domRect.top, containerRect.top)
        const visibleBottom = Math.min(domRect.bottom, containerRect.bottom)

        if (visibleBottom <= visibleTop) continue

        rects.push({
          x: domRect.left,
          y: visibleTop,
          width: domRect.width,
          height: visibleBottom - visibleTop,
        })
      }
      return rects
    }

    // 1. 文字行避让（精确到每一行，避免大块空白区域也被避让）
    for (let i = 0; i < this.subPageLinesPool.length; i++) {
      const el = this.subPageLinesPool[i]!
      const lineText = this.currentSubPageContent.lines[i]!

      // 跳过纯空行，减少计算量并允许背景穿透
      if (lineText.trim() === '║' || lineText.trim() === '') continue

      const domRect = el.getBoundingClientRect()

      rects.push({
        x: domRect.left,
        y: domRect.top,
        width: domRect.width,
        height: domRect.height,
      })
    }

    // 2. Badge 容器避让
    if (this.badgeContainer && this.badgeContainer.style.display !== 'none') {
      const badgeRect = this.badgeContainer.getBoundingClientRect()

      rects.push({
        x: badgeRect.left,
        y: badgeRect.top,
        width: badgeRect.width,
        height: badgeRect.height,
      })
    }

    // 3. Social Badge 容器避让
    if (this.socialBadgeContainer && this.socialBadgeContainer.style.display !== 'none') {
      const socialRect = this.socialBadgeContainer.getBoundingClientRect()

      rects.push({
        x: socialRect.left,
        y: socialRect.top,
        width: socialRect.width,
        height: socialRect.height,
      })
    }

    return rects
  }

  /** 清除 SubPage 的 DOM 元素 */
  clearSubPage() {
    for (const el of this.subPageLinesPool) {
      el.remove()
    }
    this.subPageLinesPool = []
    this.currentSubPageContent = null

    if (this.scrollContainer) {
      this.scrollContainer.remove()
      this.scrollContainer = null
      this.scrollInnerWrapper = null
    }

    if (this.badgeContainer) {
      this.badgeContainer.remove()
      this.badgeContainer = null
    }

    if (this.socialBadgeContainer) {
      this.socialBadgeContainer.remove()
      this.socialBadgeContainer = null
    }

    if (this.copyToast) {
      this.copyToast.remove()
      this.copyToast = null
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
