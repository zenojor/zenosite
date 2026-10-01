import { prepareWithSegments, layoutNextLine, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import gsap from 'gsap'
import { BREAKPOINTS, responsive } from '@/config/breakpoints'
import { HOME_LAYOUT, SUB_PAGE_LAYOUT } from '@/config/layout'
import { SITE_CONTENT, type SubPageContent } from '@/content/siteContent'
import type { PageName } from '@/router/pages'
import type { AsciiRenderer } from './AsciiRenderer'
import { createBadgeImage, createSocialBadgeLink, setBadgeImageHeights } from './dom/badgeElements'
import { CopyToast } from './dom/copyToast'
import { isSubPageObstacleLine } from './subPageObstacles'
import { completeSentencePrefix } from './homeBodyFlow'

export class SceneLayout {
  // ========== Home Dynamic Layout ==========
  private readonly BODY_COPY: string
  private readonly FONT = '18px "Courier New", Courier, monospace'
  private preparedBody: PreparedTextWithSegments
  private bodyViewportKey = ''

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

  // DOM element pools - home page
  private titleLinesPool: HTMLDivElement[] = []
  private textLinesPool: HTMLDivElement[] = []

  // 2D canvas for text measurement
  private textMaskCtx: CanvasRenderingContext2D

  // ========== Subpage layout (preformatted ASCII art) ==========
  private currentSubPageContent: SubPageContent | null = null
  private subPageLinesPool: HTMLDivElement[] = []

  // ========== Scrollable container ==========
  private scrollContainer: HTMLDivElement | null = null
  private scrollInnerWrapper: HTMLDivElement | null = null

  // ========== Badges ==========
  private badgeContainer: HTMLDivElement | null = null
  private socialBadgeContainer: HTMLDivElement | null = null
  private linkBadgeContainers: HTMLDivElement[] = []
  private readonly copyToast = new CopyToast()

  /**
   * 主页文字可见度：0 = 全部空格，1 = 正常显示。
   * 转场时由 GSAP 驱动，并在每帧 update() 中应用。
   */
  private homeVisibility = 1.0
  private homeVisibilityTween: gsap.core.Tween | null = null

  /**
   * 为主页文字缓存固定随机阈值。
   * Key = 元素索引，Value = 每个字符的阈值数组。
   * 只在动画开始时重新生成，确保动画期间每个字符的阈值稳定。
   */
  private homeCharThresholds: Map<number, number[]> = new Map()

  constructor() {
    this.BODY_COPY = "My name is zeno, and this is my personal website. I used three.js and pretext to build this website, just wanna let u know if u are interested in it! I'm currently learning the front-end tech stack and aspire to become a front-end engineer! "
    this.preparedBody = prepareWithSegments('', this.FONT)
    this.TITLE_LETTER_SPACINGS = this.TITLE_LINES.map(() => '0px')

    const textMaskCanvas = document.createElement('canvas')
    textMaskCanvas.width = 256
    textMaskCanvas.height = 256
    this.textMaskCtx = textMaskCanvas.getContext('2d', { willReadFrequently: true })!
  }

  // ========== Home layout ==========

  private updatePreparedBody(width: number, height: number, glyphWidth: number) {
    const key = `${window.innerWidth}:${window.innerHeight}:${width}:${height}:${glyphWidth}`
    if (key === this.bodyViewportKey) return
    this.bodyViewportKey = key

    // Choose the copy once per viewport, independently of the moving model.
    // Reserve two rows and 10% of the width for subsequent silhouette reflow.
    const columns = Math.max(0, Math.floor(width / (glyphWidth + HOME_LAYOUT.body.letterSpacing)))
    const rows = Math.max(0, Math.floor(height / HOME_LAYOUT.body.lineHeight) - 2)
    const repeats = Math.max(1, Math.ceil((columns + 1) * rows / this.BODY_COPY.length) + 1)
    const copy = this.BODY_COPY.repeat(repeats)
    const prepared = prepareWithSegments(copy, this.FONT)
    const measureScale = (glyphWidth + HOME_LAYOUT.body.letterSpacing) / glyphWidth
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    for (let row = 0; row < rows; row++) {
      const line = layoutNextLine(prepared, cursor, Math.max(0, width * 0.9) / measureScale)
      if (!line) break
      cursor = line.end
    }
    const consumed = prepared.segments.slice(0, cursor.segmentIndex).join('').length + cursor.graphemeIndex
    this.preparedBody = prepareWithSegments(completeSentencePrefix(copy, consumed), this.FONT)
  }

  /** 对字符串应用可见度效果，使用缓存的固定阈值。 */
  private applyVisibility(text: string, visibility: number, elementIndex: number): string {
    if (visibility >= 1.0) return text
    if (visibility <= 0.0) return ' '.repeat(text.length)

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

  /** 每帧更新主页动态布局。 */
  update(
    dynamicLayoutContainer: HTMLDivElement,
    navContainer: HTMLDivElement | null,
    asciiRenderer: AsciiRenderer,
  ) {
    // 1. Title Dimensions Update
    const titleRightSpace = responsive(HOME_LAYOUT.title.rightSpace)
    const availableWidth = Math.max(200, window.innerWidth / 2 - titleRightSpace - 20)
    this.textMaskCtx.font = `${HOME_LAYOUT.title.referenceFontSize}px ${this.HEADLINE_FONT_FAMILY}`
    this.textMaskCtx.letterSpacing = '0px'
    const titleWidth = Math.max(...this.TITLE_LINES.map((line) => this.textMaskCtx.measureText(line).width))
    // Fit the right-hand column continuously, including on larger screens.
    const targetFontSize = HOME_LAYOUT.title.referenceFontSize * availableWidth / titleWidth
    if (this.currentTitleFontSize !== targetFontSize || window.innerWidth !== this.lastWindowWidth) {
      this.currentTitleFontSize = targetFontSize
      this.lastWindowWidth = window.innerWidth
    }
    this.titleLineHeight = this.currentTitleFontSize

    // 2. Reserve the full title height before laying out the body.
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

    let currentTitleY = HOME_LAYOUT.title.startY

    for (let i = 0; i < this.TITLE_LINES.length; i++) {
      const el = this.titleLinesPool[i]!
      const spacing = this.TITLE_LETTER_SPACINGS[i] || '0px'

      el.textContent = this.applyVisibility(this.TITLE_LINES[i]!, this.homeVisibility, i)
      el.style.right = `${titleRightSpace}px`
      el.style.top = `${currentTitleY}px`
      el.style.font = `${this.currentTitleFontSize}px ${this.HEADLINE_FONT_FAMILY}`
      el.style.lineHeight = `${this.titleLineHeight}px`
      el.style.letterSpacing = spacing

      currentTitleY += this.titleLineHeight
    }

    // 3. Layout Body dynamically dodging boundaries
    const lineHeight = HOME_LAYOUT.body.lineHeight
    // Use the same row grid as the left ASCII, while keeping the title gap.
    const bodyTop = Math.ceil((currentTitleY + HOME_LAYOUT.body.titleGap) / lineHeight) * lineHeight
    const bodyBottom = Math.min(window.innerHeight * HOME_LAYOUT.body.bottomRatio, window.innerHeight - HOME_LAYOUT.body.bottomPadding)
    const region = {
      x: window.innerWidth / 2 + HOME_LAYOUT.body.xOffset,
      y: bodyTop,
      width: Math.max(0, window.innerWidth / 2 - HOME_LAYOUT.body.rightPadding),
      height: Math.max(0, bodyBottom - bodyTop),
    }
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let lineTop = region.y
    const linesData = []

    this.textMaskCtx.font = this.FONT
    this.textMaskCtx.letterSpacing = '0px'
    const glyphWidth = this.textMaskCtx.measureText('M').width
    this.updatePreparedBody(window.innerWidth - titleRightSpace - 20 - region.x, region.height, glyphWidth)
    // Pretext 0.0.3 measures without CSS letter spacing. Reduce its available
    // width to account for the 1px spacing on every monospace body character.
    const measureScale = (glyphWidth + HOME_LAYOUT.body.letterSpacing) / glyphWidth

    // The 70% target selects the copy; the space above navigation is available
    // for reflow, so a completed last sentence is never clipped at that target.
    const flowBottom = window.innerHeight - HOME_LAYOUT.body.bottomPadding
    while (lineTop + lineHeight <= flowBottom) {
      let slotLeft = region.x
      const currentSlotRight = window.innerWidth - titleRightSpace - 20

      const limits = asciiRenderer.getObstacleLimits(lineTop, lineHeight)
      if (limits.modelRight > 0) {
        slotLeft = Math.max(slotLeft, limits.modelRight + HOME_LAYOUT.body.modelDodgePadding)
      }

      const width = currentSlotRight - slotLeft
      if (width >= glyphWidth + HOME_LAYOUT.body.letterSpacing) {
        const line = layoutNextLine(this.preparedBody, cursor, width / measureScale)
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
      el.style.color = 'var(--text-muted-color)'
      el.style.letterSpacing = `${HOME_LAYOUT.body.letterSpacing}px`
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

  // ========== Subpage layout (preformatted ASCII art, right aligned) ==========

  /** 获取 SubPage 所有活跃的文字 DOM 元素。 */
  getSubPageElements(): HTMLDivElement[] {
    return [...this.subPageLinesPool]
  }

  /** 获取 SubPage 所有活跃的文字内容。 */
  getSubPageTexts(): string[] {
    return this.subPageLinesPool.map((el) => el.textContent || '')
  }

  /**
   * 渲染子页面：预格式化 ASCII Art 文本块，支持右对齐。
   * 自动计算字号，让最长行尽量填满可用区域。
   */
  updateSubPage(
    pageName: Exclude<PageName, 'home'>,
    dynamicLayoutContainer: HTMLDivElement,
    _asciiRenderer: AsciiRenderer,
  ) {
    const content = SITE_CONTENT[pageName]
    if (!content) return
    this.currentSubPageContent = content

    const pageConfig = SUB_PAGE_LAYOUT[pageName]
    const rightMargin = responsive(pageConfig.rightMargin)
    const leftMargin = responsive(pageConfig.leftMargin)

    // 找到最长行的字符数。
    const maxLineLen = Math.max(...content.lines.map((l) => l.length))

    const availableWidth = Math.max(200, window.innerWidth / 2 - rightMargin)

    // 等宽字体：每个字符宽度约等于 fontSize * 0.6。
    const targetFontSize = Math.max(pageConfig.minFontSize, Math.min(pageConfig.maxFontSize, Math.floor(availableWidth / (maxLineLen * 0.6))))
    const lineHeight = targetFontSize // 与主页一致。
    // 整体内容高度。
    const totalHeight = content.lines.length * lineHeight

    const fontStr = `${targetFontSize}px ${this.HEADLINE_FONT_FAMILY}`

    // ---- Scrollable mode ----
    if (content.scrollable) {
      this.updateSubPageScrollable(
        content, pageConfig, dynamicLayoutContainer,
        rightMargin, leftMargin, maxLineLen,
        targetFontSize, lineHeight, totalHeight, fontStr,
      )
      return
    }

    // ---- Normal (non-scrollable) mode ----
    // 垂直居中。
    let startY = Math.max(20, Math.floor((window.innerHeight - totalHeight) / 2))

    if (pageConfig.verticalOffset > 0) {
      startY += Math.floor(window.innerHeight * pageConfig.verticalOffset)
    }

    // 水平右对齐：从屏幕右侧减去 margin。
    const rightPos = rightMargin

    // DOM pool management
    while (this.subPageLinesPool.length < content.lines.length) {
      const el = document.createElement('div')
      el.className = 'dynamic-line subpage-line'
      el.style.position = 'absolute'
      el.style.color = 'var(--text-muted-color)'
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
      const badgeLineIndex = content.badgeAnchorLineIndex + 1
      const badgeY = startY + badgeLineIndex * lineHeight + 2

      // 计算文本块右边界的 X 坐标，与文字对齐。
      this.textMaskCtx.font = fontStr
      const sampleLine = content.lines[content.badgeAnchorLineIndex]!
      const textBlockWidth = this.textMaskCtx.measureText(sampleLine).width
      const badgeRight = window.innerWidth - rightMargin
      const badgeStartX = pageConfig.textAlign === 'left'
        ? leftMargin
        : badgeRight - textBlockWidth + targetFontSize * 0.6 * 4 // 缩进约 4 个字符。

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

      // 确保内容同步。
      const existingImgs = Array.from(this.badgeContainer.querySelectorAll('img'))
      if (existingImgs.length !== content.badges.length) {
        this.badgeContainer.innerHTML = ''
        for (const url of content.badges) {
          this.badgeContainer.appendChild(createBadgeImage(url, lineHeight))
        }
      }

      const badgeAreaWidth = textBlockWidth - targetFontSize * 0.6 * 8
      this.badgeContainer.style.left = `${badgeStartX}px`
      this.badgeContainer.style.top = `${badgeY}px`
      this.badgeContainer.style.width = `${badgeAreaWidth}px`
      this.badgeContainer.style.display = 'flex'

      // 更新 badge 图片高度。
      setBadgeImageHeights(this.badgeContainer, lineHeight)
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
          this.socialBadgeContainer.appendChild(createSocialBadgeLink(badge, lineHeight, (text) => {
            this.copyToast.show(text)
          }))
        }
      }

      // Position social badge container
      const socialBadgeAreaWidth = socialTextBlockWidth - targetFontSize * 0.6 * 8
      this.socialBadgeContainer.style.left = `${socialBadgeStartX}px`
      this.socialBadgeContainer.style.top = `${socialY}px`
      this.socialBadgeContainer.style.width = `${socialBadgeAreaWidth}px`
      this.socialBadgeContainer.style.display = 'flex'

      // Update social badge img heights
      setBadgeImageHeights(this.socialBadgeContainer, lineHeight)
    } else {
      if (this.socialBadgeContainer) {
        this.socialBadgeContainer.style.display = 'none'
      }
    }
  }

  /** 渲染可滚动子页面：长内容在固定区域内部滚动。 */
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
          background: var(--scrollbar-color);
          border-radius: 2px;
        }
        .subpage-scroll-container::-webkit-scrollbar-thumb:hover {
          background: var(--scrollbar-hover-color);
        }
        .subpage-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: var(--scrollbar-color) transparent;
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

    // DOM pool: lines go inside scrollInnerWrapper.
    const parent = this.scrollInnerWrapper!
    while (this.subPageLinesPool.length < content.lines.length) {
      const el = document.createElement('div')
      el.className = 'dynamic-line subpage-line'
      el.style.position = 'relative'
      el.style.display = 'block'
      el.style.color = 'var(--text-muted-color)'
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

    this.updateScrollableLinkBadges(content, parent, lineHeight, pageConfig.textAlign)
  }

  private updateScrollableLinkBadges(
    content: SubPageContent,
    parent: HTMLDivElement,
    lineHeight: number,
    textAlign: 'left' | 'right',
  ) {
    const groups = content.linkBadgeGroups ?? []

    while (this.linkBadgeContainers.length < groups.length) {
      const container = document.createElement('div')
      container.className = 'subpage-link-badges'
      container.style.position = 'relative'
      container.style.display = 'flex'
      container.style.flexWrap = 'wrap'
      container.style.gap = '4px'
      container.style.alignItems = 'center'
      container.style.pointerEvents = 'auto'
      container.style.marginTop = '6px'
      container.style.marginBottom = `${Math.max(8, lineHeight * 0.9)}px`
      this.linkBadgeContainers.push(container)
    }

    while (this.linkBadgeContainers.length > groups.length) {
      const container = this.linkBadgeContainers.pop()!
      container.remove()
    }

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]!
      const container = this.linkBadgeContainers[i]!
      const signature = JSON.stringify(group.badges)

      if (container.dataset.signature !== signature) {
        container.innerHTML = ''
        container.dataset.signature = signature

        for (const badge of group.badges) {
          container.appendChild(createSocialBadgeLink(badge, lineHeight, (text) => {
            this.copyToast.show(text)
          }))
        }
      }

      container.style.alignSelf = textAlign === 'left' ? 'flex-start' : 'flex-end'
      setBadgeImageHeights(container, lineHeight)

      const anchorLine = this.subPageLinesPool[group.afterLineIndex]
      if (!anchorLine) {
        container.remove()
        continue
      }

      const nextSibling = anchorLine.nextSibling
      if (nextSibling !== container) {
        parent.insertBefore(container, nextSibling)
      }
    }
  }

  /** 获取 badge 容器元素，用于动画。 */
  getBadgeContainer(): HTMLDivElement | null {
    return this.badgeContainer
  }

  /** 获取 social badge 容器元素，用于动画。 */
  getSocialBadgeContainer(): HTMLDivElement | null {
    return this.socialBadgeContainer
  }

  /** 获取 SubPage 页面所有文本块区域，用于 ASCII 避让，精确到行。 */
  getSubPageRects(): { x: number; y: number; width: number; height: number }[] {
    const rects: { x: number; y: number; width: number; height: number }[] = []
    if (!this.currentSubPageContent) return rects

    // Scrollable mode: dodge only the visible text lines so the ASCII wrap is not a rigid column.
    if (this.scrollContainer) {
      const containerRect = this.scrollContainer.getBoundingClientRect()
      for (let i = 0; i < this.subPageLinesPool.length; i++) {
        const el = this.subPageLinesPool[i]!
        const lineText = this.currentSubPageContent.lines[i]!

        if (!isSubPageObstacleLine(lineText)) continue

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

      for (const container of this.linkBadgeContainers) {
        const domRect = container.getBoundingClientRect()
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

    // 1. Avoid text lines precisely instead of blanking a whole text block.
    for (let i = 0; i < this.subPageLinesPool.length; i++) {
      const el = this.subPageLinesPool[i]!
      const lineText = this.currentSubPageContent.lines[i]!

      // Skip empty lines to reduce work and allow the background to show through.
      if (!isSubPageObstacleLine(lineText)) continue

      const domRect = el.getBoundingClientRect()

      rects.push({
        x: domRect.left,
        y: domRect.top,
        width: domRect.width,
        height: domRect.height,
      })
    }

    // 2. Badge 容器避让。
    if (this.badgeContainer && this.badgeContainer.style.display !== 'none') {
      const badgeRect = this.badgeContainer.getBoundingClientRect()

      rects.push({
        x: badgeRect.left,
        y: badgeRect.top,
        width: badgeRect.width,
        height: badgeRect.height,
      })
    }

    // 3. Social Badge 容器避让。
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

  /** 清除主页 DOM 元素。 */
  clearHome() {
    this.bodyViewportKey = ''
    for (const el of this.titleLinesPool) {
      el.remove()
    }
    this.titleLinesPool = []

    for (const el of this.textLinesPool) {
      el.remove()
    }
    this.textLinesPool = []
  }

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

    for (const container of this.linkBadgeContainers) {
      container.remove()
    }
    this.linkBadgeContainers = []

    this.copyToast.dispose()
  }

  clearAll() {
    this.clearHome()
    this.clearSubPage()
  }

  /**
   * 主页文字消散动画：可见度从 1 到 0。
   * 动画期间 update() 仍逐帧运行，并自动应用效果。
   */
  animateHomeDissolve(duration = 1.0): Promise<void> {
    this.killHomeTween()
    // 动画开始时重新生成阈值，让每次消散的波前图案不同。
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
   * 主页文字重现动画：可见度从 0 到 1。
   * 动画期间 update() 仍逐帧运行，并自动应用效果。
   */
  animateHomeMaterialize(duration = 1.0): Promise<void> {
    this.killHomeTween()
    this.homeVisibility = 0
    // 动画开始时重新生成阈值，让每次重现的波前图案不同。
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

  /** 立即设置主页文字可见度（无动画）。 */
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
