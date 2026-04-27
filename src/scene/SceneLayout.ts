import { prepareWithSegments, layoutNextLine, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import gsap from 'gsap'
import { BREAKPOINTS, responsive } from '@/config/breakpoints'
import { HOME_LAYOUT, SUB_PAGE_LAYOUT } from '@/config/layout'
import { SITE_CONTENT, type SubPageContent } from '@/content/siteContent'
import type { PageName } from '@/router/pages'
import type { AsciiRenderer } from './AsciiRenderer'
import { createBadgeImage, createSocialBadgeLink, setBadgeImageHeights } from './dom/badgeElements'
import { CopyToast } from './dom/copyToast'

export class SceneLayout {
  // ========== 涓婚〉 Dynamic Layout ==========
  private readonly BODY_COPY: string
  private readonly FONT = '18px "Courier New", Courier, monospace'
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

  // DOM element pools - 涓婚〉
  private titleLinesPool: HTMLDivElement[] = []
  private textLinesPool: HTMLDivElement[] = []

  // 2D canvas for text measurement
  private textMaskCtx: CanvasRenderingContext2D

  // ========== SubPage 甯冨眬锛堥鏍煎紡鍖?ASCII Art锛?==========
  private currentSubPageContent: SubPageContent | null = null
  private subPageLinesPool: HTMLDivElement[] = []

  // ========== Scrollable container ==========
  private scrollContainer: HTMLDivElement | null = null
  private scrollInnerWrapper: HTMLDivElement | null = null

  // ========== Badges ==========
  private badgeContainer: HTMLDivElement | null = null
  private socialBadgeContainer: HTMLDivElement | null = null
  private readonly copyToast = new CopyToast()

  /**
   * 涓婚〉鏂囧瓧鍙搴︼細0 = 鍏ㄩ儴绌烘牸锛? = 姝ｅ父鏄剧ず銆?   * 杞満鏃剁敱 GSAP 椹卞姩锛屾瘡甯ч殢 update() 涓€璧峰簲鐢ㄣ€?   */
  private homeVisibility = 1.0
  private homeVisibilityTween: gsap.core.Tween | null = null

  /**
   * 涓轰富椤垫枃瀛楃紦瀛樼殑鍥哄畾闅忔満闃堝€笺€?   * Key = 鍏冪礌绱㈠紩, Value = 姣忎釜瀛楃鐨勯槇鍊兼暟缁勩€?   * 浠呭湪鍔ㄧ敾寮€濮嬫椂锛堟秷鏁?閲嶇幇锛夐噸鏂扮敓鎴愶紝纭繚鍔ㄧ敾鏈熼棿姣忎釜瀛楃鐨勯槇鍊肩ǔ瀹氥€?   */
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

  // ========== 涓婚〉甯冨眬 ==========

  /** 瀵瑰瓧绗︿覆搴旂敤鍙搴︽晥鏋滐紙浣跨敤缂撳瓨鐨勫浐瀹氶槇鍊硷級 */
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

  /** 姣忓抚鏇存柊涓婚〉鍔ㄦ€佸竷灞€ - 淇濈暀鍘熷瀹炵幇鐨勬墍鏈夐€昏緫 */
  update(
    dynamicLayoutContainer: HTMLDivElement,
    navContainer: HTMLDivElement | null,
    asciiRenderer: AsciiRenderer,
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

      const limits = asciiRenderer.getObstacleLimits(lineTop, lineHeight)
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

  // ========== SubPage 甯冨眬锛堥鏍煎紡鍖?ASCII Art锛屽彸瀵归綈锛?==========

  /** 鑾峰彇 SubPage 鎵€鏈夋椿璺冪殑鏂囧瓧 DOM 鍏冪礌 */
  getSubPageElements(): HTMLDivElement[] {
    return [...this.subPageLinesPool]
  }

  /** 鑾峰彇 SubPage 鎵€鏈夋椿璺冪殑鏂囧瓧鍐呭 */
  getSubPageTexts(): string[] {
    return this.subPageLinesPool.map((el) => el.textContent || '')
  }

  /**
   * 娓叉煋瀛愰〉闈?鈥?棰勬牸寮忓寲 ASCII Art 妗嗭紝鍙冲榻愩€?   * 鑷姩璁＄畻瀛楀彿浣挎渶闀胯鎭板ソ濉弧鍙敤鍖哄煙銆?   */
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

    // 鎵惧埌鏈€闀胯鐨勫瓧绗︽暟
    const maxLineLen = Math.max(...content.lines.map((l) => l.length))

    const availableWidth = Math.max(200, window.innerWidth / 2 - rightMargin)

    // 绛夊瀛椾綋锛氭瘡涓瓧绗﹀搴?鈮?fontSize 脳 0.6
    const targetFontSize = Math.max(pageConfig.minFontSize, Math.min(pageConfig.maxFontSize, Math.floor(availableWidth / (maxLineLen * 0.6))))
    const lineHeight = targetFontSize // 涓庝富椤典竴鑷?
    // 鏁翠綋鍐呭楂樺害
    const totalHeight = content.lines.length * lineHeight

    const fontStr = `${targetFontSize}px ${this.HEADLINE_FONT_FAMILY}`

    // 鈹€鈹€ Scrollable mode 鈹€鈹€
    if (content.scrollable) {
      this.updateSubPageScrollable(
        content, pageConfig, dynamicLayoutContainer,
        rightMargin, leftMargin, maxLineLen,
        targetFontSize, lineHeight, totalHeight, fontStr,
      )
      return
    }

    // 鈹€鈹€ Normal (non-scrollable) mode 鈹€鈹€
    // 鍨傜洿灞呬腑
    let startY = Math.max(20, Math.floor((window.innerHeight - totalHeight) / 2))

    if (pageConfig.verticalOffset > 0) {
      startY += Math.floor(window.innerHeight * pageConfig.verticalOffset)
    }

    // 姘村钩鍙冲榻愶細浠庡睆骞曞彸杈瑰噺鍘?margin
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
      const badgeLineIndex = content.badgeAnchorLineIndex + 1
      const badgeY = startY + badgeLineIndex * lineHeight + 2

      // 璁＄畻鏂囨湰鍧楀彸杈圭晫鐨?X 鍧愭爣锛堜笌鏂囧瓧瀵归綈锛?      this.textMaskCtx.font = fontStr
      const sampleLine = content.lines[content.badgeAnchorLineIndex]!
      const textBlockWidth = this.textMaskCtx.measureText(sampleLine).width
      const badgeRight = window.innerWidth - rightMargin
      const badgeStartX = pageConfig.textAlign === 'left'
        ? leftMargin
        : badgeRight - textBlockWidth + targetFontSize * 0.6 * 4 // 缂╄繘 ~4 瀛楃

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

      // 纭繚鍐呭鍚屾
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

      // 鏇存柊 badge 鍥剧墖楂樺害
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

  /** 娓叉煋鍙粴鍔ㄥ瓙椤甸潰 鈥?闀垮唴瀹瑰湪鍥哄畾鍖哄煙鍐呴儴婊氬姩 */
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

    // DOM pool 鈥?lines go inside scrollInnerWrapper
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

  /** 鑾峰彇 badge 瀹瑰櫒鍏冪礌锛堢敤浜庡姩鐢伙級 */
  getBadgeContainer(): HTMLDivElement | null {
    return this.badgeContainer
  }

  /** 鑾峰彇 social badge 瀹瑰櫒鍏冪礌锛堢敤浜庡姩鐢伙級 */
  getSocialBadgeContainer(): HTMLDivElement | null {
    return this.socialBadgeContainer
  }

  /** 鑾峰彇 SubPage 椤甸潰鐨勬墍鏈夋枃鏈潡鍖哄煙锛岀敤浜?ASCII 瑙勯伩锛堢簿纭埌琛岋級 */
  getSubPageRects(): { x: number; y: number; width: number; height: number }[] {
    const rects: { x: number; y: number; width: number; height: number }[] = []
    if (!this.currentSubPageContent) return rects

    // Scrollable mode: dodge only the visible text lines so the ASCII wrap is not a rigid column.
    if (this.scrollContainer) {
      const containerRect = this.scrollContainer.getBoundingClientRect()
      for (let i = 0; i < this.subPageLinesPool.length; i++) {
        const el = this.subPageLinesPool[i]!
        const lineText = this.currentSubPageContent.lines[i]!

        if (lineText.trim() === '閳?' || lineText.trim() === '') continue

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

    // 1. Avoid text lines precisely instead of blanking a whole text block.
    for (let i = 0; i < this.subPageLinesPool.length; i++) {
      const el = this.subPageLinesPool[i]!
      const lineText = this.currentSubPageContent.lines[i]!

      // Skip empty lines to reduce work and allow the background to show through.
      if (lineText.trim() === '鈺?' || lineText.trim() === '') continue

      const domRect = el.getBoundingClientRect()

      rects.push({
        x: domRect.left,
        y: domRect.top,
        width: domRect.width,
        height: domRect.height,
      })
    }

    // 2. Badge 瀹瑰櫒閬胯
    if (this.badgeContainer && this.badgeContainer.style.display !== 'none') {
      const badgeRect = this.badgeContainer.getBoundingClientRect()

      rects.push({
        x: badgeRect.left,
        y: badgeRect.top,
        width: badgeRect.width,
        height: badgeRect.height,
      })
    }

    // 3. Social Badge 瀹瑰櫒閬胯
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

  /** 娓呴櫎 SubPage 鐨?DOM 鍏冪礌 */
  clearHome() {
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

    this.copyToast.dispose()
  }

  clearAll() {
    this.clearHome()
    this.clearSubPage()
  }

  /**
   * 涓婚〉鏂囧瓧娑堟暎鍔ㄧ敾锛氬彲瑙佸害浠?1 鈫?0
   * 鍦ㄥ姩鐢绘湡闂?update() 姣忓抚浠嶈繍琛岋紝鑷姩搴旂敤鏁堟灉
   */
  animateHomeDissolve(duration = 1.0): Promise<void> {
    this.killHomeTween()
    // 鍔ㄧ敾寮€濮嬫椂閲嶆柊鐢熸垚闃堝€硷紝浣挎瘡娆℃秷鏁ｇ殑娉㈠墠鍥炬涓嶅悓
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
   * 涓婚〉鏂囧瓧閲嶇幇鍔ㄧ敾锛氬彲瑙佸害浠?0 鈫?1
   * 鍦ㄥ姩鐢绘湡闂?update() 姣忓抚浠嶈繍琛岋紝鑷姩搴旂敤鏁堟灉
   */
  animateHomeMaterialize(duration = 1.0): Promise<void> {
    this.killHomeTween()
    this.homeVisibility = 0
    // 鍔ㄧ敾寮€濮嬫椂閲嶆柊鐢熸垚闃堝€硷紝浣挎瘡娆￠噸鐜扮殑娉㈠墠鍥炬涓嶅悓
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

  /** 绔嬪嵆璁剧疆涓婚〉鏂囧瓧鍙搴︼紙鏃犲姩鐢伙級 */
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

