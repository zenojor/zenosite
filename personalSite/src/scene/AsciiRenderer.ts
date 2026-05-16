import * as THREE from 'three'
import type { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import gsap from 'gsap'
import { ASCII_CONFIG } from '@/config/ascii'

const MONO_RAMP = ' .`-_:,;^=+/|)\\!?0oOQ#%@'
const CHAR_WIDTH = ASCII_CONFIG.charWidth
const CHAR_HEIGHT = ASCII_CONFIG.charHeight
const RANDOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?/\\|=+-_.:;,^~'

export interface ObstacleLimits {
  modelRight: number
  modelLeft: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface AsciiOptions {
  mode: 'home' | 'about' | 'subpage'
  domObstacles?: Rect[]
}

export interface SubPageAsciiOptions {
  domObstacles: Rect[]
  overlayOffsetX?: number
  overlayOffsetY?: number
  zoom?: number
  trackModelCenter?: boolean
  verticalShiftFactor?: number
  modelSearchRadius?: number
  domPaddingX?: number
  domPaddingY?: number
}

export class AsciiRenderer {
  // Silhouette Mask
  private maskWidth = 256
  private maskHeight = 256
  private maskRenderTarget: THREE.WebGLRenderTarget
  private maskMaterial: THREE.MeshBasicMaterial
  private maskBuffer: Uint8Array

  // ASCII
  private asciiCols: number
  private asciiRows: number
  private asciiRenderTarget: THREE.WebGLRenderTarget
  private asciiMaterial: THREE.MeshLambertMaterial
  private readBuffer: Uint8Array
  private asciiContentBuffer: Uint8Array

  // Dedicated About ASCII (Full Screen)
  private aboutAsciiCols: number
  private aboutAsciiRows: number
  private aboutAsciiRenderTarget: THREE.WebGLRenderTarget
  private aboutAsciiContentBuffer: Uint8Array

  private asciiLinesPool: HTMLDivElement[] = []
  private domObstacles: Rect[] = []

  /**
   * ASCII visibility progress: 0 = hidden, 1 = fully rendered.
   * During transitions, characters are revealed or hidden by fixed random thresholds.
   */
  private asciiVisibility = 1.0
  private asciiVisibilityTween: gsap.core.Tween | null = null
  /**
   * Fixed random thresholds for ASCII characters.
   * Regenerated only when an animation starts.
   */
  private asciiCharThresholds: Map<number, number> = new Map()

  constructor() {
    // Silhouette Mask for Dynamic Layout
    this.maskRenderTarget = new THREE.WebGLRenderTarget(this.maskWidth, this.maskHeight)
    this.maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.maskBuffer = new Uint8Array(this.maskWidth * this.maskHeight * 4)

    // 配置 ASCII 渲染目标，默认使用左半屏。
    this.asciiCols = Math.floor((window.innerWidth / 2) / CHAR_WIDTH)
    this.asciiRows = Math.floor(window.innerHeight / CHAR_HEIGHT)
    this.asciiRenderTarget = new THREE.WebGLRenderTarget(this.asciiCols, this.asciiRows)
    this.asciiMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.readBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)
    this.asciiContentBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)

    // Full Screen About ASCII Initialize
    const fullCols = Math.floor(window.innerWidth / CHAR_WIDTH)
    this.aboutAsciiCols = fullCols
    this.aboutAsciiRows = this.asciiRows
    this.aboutAsciiRenderTarget = new THREE.WebGLRenderTarget(this.aboutAsciiCols, this.aboutAsciiRows)
    this.aboutAsciiContentBuffer = new Uint8Array(this.aboutAsciiCols * this.aboutAsciiRows * 4)
  }

  /** Set additional DOM obstacle rectangles for ASCII avoidance. */
  setDomObstacles(rects: Rect[]) {
    this.domObstacles = rects
  }

  /** Shared Helper: CPU limits scanner from GPU mask buffer */
  getObstacleLimits(lineTop: number, lineHeight: number): ObstacleLimits {
    // 3D Model: WebGL buffer is bottom-up
    const rawMaskYTop = (1 - lineTop / window.innerHeight) * (this.maskHeight - 1)
    const rawMaskYBottom = (1 - (lineTop + lineHeight) / window.innerHeight) * (this.maskHeight - 1)
    const wTop = Math.floor(Math.max(0, Math.min(this.maskHeight - 1, rawMaskYTop)))
    const wBottom = Math.floor(Math.max(0, Math.min(this.maskHeight - 1, rawMaskYBottom)))

    let modelMaxX = -1
    let modelMinX = this.maskWidth
    for (let my = wBottom; my <= wTop; my++) {
      for (let mx = this.maskWidth - 1; mx >= 0; mx--) {
        const i = (my * this.maskWidth + mx) * 4
        if (this.maskBuffer[i]! > 0) {
          if (mx > modelMaxX) modelMaxX = mx
          break
        }
      }
      for (let mx = 0; mx < this.maskWidth; mx++) {
        const i = (my * this.maskWidth + mx) * 4
        if (this.maskBuffer[i]! > 0) {
          if (mx < modelMinX) modelMinX = mx
          break
        }
      }
    }

    return {
      modelRight: modelMaxX >= 0 ? (modelMaxX / this.maskWidth) * window.innerWidth : -1,
      modelLeft: modelMinX < this.maskWidth ? (modelMinX / this.maskWidth) * window.innerWidth : window.innerWidth,
    }
  }

  /** Silhouette Pass: render the scene with override material to get model silhouette */
  renderSilhouettePass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    groundMirror: Reflector,
  ) {
    const prevBg = scene.background
    const prevOverride = scene.overrideMaterial
    const groundVis = groundMirror.visible

    scene.background = new THREE.Color(0x000000)
    scene.overrideMaterial = this.maskMaterial
    groundMirror.visible = false

    // We render the full screen into a squashed 256x256 buffer
    renderer.setRenderTarget(this.maskRenderTarget)
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(this.maskRenderTarget, 0, 0, this.maskWidth, this.maskHeight, this.maskBuffer)

    renderer.setRenderTarget(null)
    scene.background = prevBg
    scene.overrideMaterial = prevOverride
    groundMirror.visible = groundVis
  }

  /** ASCII Pass: render to low-res target for ASCII conversion, then populate DOM */
  renderAsciiPass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    groundMirror: Reflector,
    asciiContainer: HTMLDivElement,
    options: AsciiOptions = { mode: 'home' },
    model?: THREE.Object3D | null,
  ) {
    const prevBg = scene.background
    const prevOverride = scene.overrideMaterial
    const groundVis = groundMirror.visible
    const prevZoom = camera.zoom
    const prevAspect = camera.aspect

    scene.background = new THREE.Color(0x000000)
    scene.overrideMaterial = this.asciiMaterial
    groundMirror.visible = false

    // --- 相机投影矩阵平移（View Offset）核心逻辑 ---

    // 1. 获取模型中心在当前屏幕上的投影点（像素）。
    // Update camera matrices before projecting to screen space.
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()

    const projectionTarget = new THREE.Vector3(0, 0, 0)
    // Subpages can track the model center; home keeps the world origin stable.
    if ((options.mode === 'about' || options.mode === 'subpage') && model) {
      model.updateMatrixWorld()
      const box = new THREE.Box3().setFromObject(model)
      box.getCenter(projectionTarget)
    }

    const modelProjected = projectionTarget.clone().project(camera)
    const pxX = (modelProjected.x * 0.5 + 0.5) * window.innerWidth
    const pxY = (1 - (modelProjected.y * 0.5 + 0.5)) * window.innerHeight

    // 2. 计算视图偏移（View Offset）。
    const zoom = ASCII_CONFIG.home.zoom
    // The sub-viewport dimensions must match the render target ratio to avoid stretching.
    const subWidth = (window.innerWidth / 2) / zoom
    const subHeight = window.innerHeight / zoom
    // Center the projected model point in the sub-viewport.
    const offsetX = pxX - subWidth / 2
    const offsetY = pxY - subHeight / 2

    // Apply a view offset without changing the camera direction.
    camera.setViewOffset(window.innerWidth, window.innerHeight, offsetX, offsetY, subWidth, subHeight)
    // 重置额外 zoom。
    camera.zoom = 1
    camera.updateProjectionMatrix()

    renderer.setRenderTarget(this.asciiRenderTarget)

    // 3. Render once with asciiMaterial to generate character brightness.
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(this.asciiRenderTarget, 0, 0, this.asciiCols, this.asciiRows, this.asciiContentBuffer)

    const asciiLinesData = []
    const obstacles = options.domObstacles || this.domObstacles

    // Offset used when ASCII is centered on screen.
    const canvasWidth = this.asciiCols * CHAR_WIDTH
    const screenOffsetX = options.mode === 'home' ? 0 : Math.floor((window.innerWidth - canvasWidth) / 2)

    const fullCols = Math.floor(window.innerWidth / CHAR_WIDTH)

    for (let r = this.asciiRows - 1; r >= 0; r--) {
      const lineTop = (this.asciiRows - 1 - r) * CHAR_HEIGHT
      const limits = this.getObstacleLimits(lineTop, CHAR_HEIGHT)

      // 3D silhouette boundary check. Home uses a simple left-side cutoff.
      let limitCol = this.asciiCols
      if (options.mode === 'home') {
        if (limits.modelLeft < window.innerWidth) {
          const padding = ASCII_CONFIG.home.modelDodgePadding
          limitCol = Math.floor((limits.modelLeft - padding) / CHAR_WIDTH)
        }
      }

      let rowChars = ''
      for (let c = 0; c < this.asciiCols; c++) {
        const absoluteScreenPointX = screenOffsetX + c * CHAR_WIDTH

        // 1. 避让 3D 轮廓（Home 模式左侧逻辑）。
        if (options.mode === 'home' && c > limitCol) {
          break
        }

        // 2. 避让 3D 轮廓（About/Subpage 基于全屏 maskBuffer 的亮度）。
        // Sample the character center to avoid the visible model silhouette.
        const u = (absoluteScreenPointX + CHAR_WIDTH / 2) / window.innerWidth
        const v = 1 - ((lineTop + CHAR_HEIGHT / 2) / window.innerHeight)
        const mx = Math.floor(u * this.maskWidth)
        const my = Math.floor(v * this.maskHeight)

        if ((options.mode === 'about' || options.mode === 'subpage') && mx >= 0 && mx < this.maskWidth && my >= 0 && my < this.maskHeight) {
          const maskIdx = (my * this.maskWidth + mx) * 4
          if (this.maskBuffer[maskIdx]! > 20) {
            rowChars += ' '
            continue
          }
        }

        // 3. Avoid DOM obstacles.
        let hitDom = false
        const horizontalPadding = ASCII_CONFIG.home.domPaddingX
        const verticalPadding = ASCII_CONFIG.home.domPaddingY
        for (const rect of obstacles) {
          const charCenterX = absoluteScreenPointX + CHAR_WIDTH / 2
          const charCenterY = lineTop + CHAR_HEIGHT / 2
          if (
            charCenterX > rect.x - horizontalPadding &&
            charCenterX < rect.x + rect.width + horizontalPadding &&
            charCenterY > rect.y - verticalPadding &&
            charCenterY < rect.y + rect.height + verticalPadding
          ) {
            hitDom = true
            break
          }
        }

        if (hitDom) {
          rowChars += ' '
          continue
        }

        // 4. 将真实场景亮度转换为字符。
        const pixelIdx = (r * this.asciiCols + c) * 4
        const brightness = (this.asciiContentBuffer[pixelIdx]! + this.asciiContentBuffer[pixelIdx + 1]! + this.asciiContentBuffer[pixelIdx + 2]!) / 3
        const proportion = brightness / 255.0
        const rampIdx = Math.min(MONO_RAMP.length - 1, Math.floor(proportion * MONO_RAMP.length))
        let ch = MONO_RAMP[rampIdx]!

        // Visibility effect.
        if (this.asciiVisibility < 1.0) {
          const key = r * 10000 + c
          let threshold = this.asciiCharThresholds.get(key)
          if (threshold === undefined) {
            threshold = Math.random() * 0.6 + 0.15
            this.asciiCharThresholds.set(key, threshold)
          }
          if (this.asciiVisibility < threshold) ch = ' '
        }

        rowChars += ch
      }
      asciiLinesData.push({ x: 0, y: lineTop, text: rowChars })
    }

    // DOM pool management
    while (this.asciiLinesPool.length < asciiLinesData.length) {
      const el = document.createElement('div')
      el.className = 'ascii-line'
      el.style.position = 'absolute'
      el.style.fontFamily = "'Courier New', Courier, monospace"
      el.style.fontSize = '18px'
      el.style.lineHeight = '18px'
      el.style.letterSpacing = '1px'
      el.style.color = 'var(--text-muted-color)'
      el.style.pointerEvents = 'none'
      el.style.whiteSpace = 'pre'
      asciiContainer.appendChild(el)
      this.asciiLinesPool.push(el)
    }
    while (this.asciiLinesPool.length > asciiLinesData.length) {
      const el = this.asciiLinesPool.pop()!
      el.remove()
    }
    for (let i = 0; i < asciiLinesData.length; i++) {
      const data = asciiLinesData[i]
      const el = this.asciiLinesPool[i]
      if (el && data) {
        el.textContent = data.text
        el.style.left = `${data.x}px`
        el.style.top = `${data.y}px`
      }
    }

    renderer.setRenderTarget(null)
    scene.background = prevBg
    scene.overrideMaterial = prevOverride
    groundMirror.visible = groundVis

    // Clear the view offset and restore the original projection matrix.
    camera.clearViewOffset()
    camera.zoom = prevZoom
    camera.aspect = prevAspect
    camera.updateProjectionMatrix()
  }

  /** About/Subpage Pass: full-screen version, isolated from the home-page ASCII logic. */
  renderAboutAsciiPass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    groundMirror: Reflector,
    asciiContainer: HTMLDivElement,
    options: SubPageAsciiOptions,
    model?: THREE.Object3D | null,
  ) {
    const prevBg = scene.background
    const prevOverride = scene.overrideMaterial
    const groundVis = groundMirror.visible
    const prevZoom = camera.zoom
    const prevAspect = camera.aspect

    scene.background = new THREE.Color(0x000000)
    scene.overrideMaterial = this.asciiMaterial
    groundMirror.visible = false

    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()

    // 1. 获取追踪目标中心。
    const projectionTarget = new THREE.Vector3(0, 0, 0)
    if ((options.trackModelCenter ?? true) && model) {
      model.updateMatrixWorld()
      const box = new THREE.Box3().setFromObject(model)
      box.getCenter(projectionTarget)
    }

    const modelProjected = projectionTarget.clone().project(camera)
    const pxX = (modelProjected.x * 0.5 + 0.5) * window.innerWidth
    const pxY = (1 - (modelProjected.y * 0.5 + 0.5)) * window.innerHeight

    // 2. 计算视图偏移（2.0x 全屏裁剪，不产生截断）。
    const zoom = options.zoom ?? 2.0
    const fullWidth = window.innerWidth * zoom
    const fullHeight = window.innerHeight * zoom
    const subWidth = window.innerWidth
    const subHeight = window.innerHeight

    const screenOffsetX = options.overlayOffsetX ?? 0
    const overlayOffsetY = options.overlayOffsetY ?? 0

    const verticalShift = window.innerHeight * (options.verticalShiftFactor ?? 0.15)
    const offsetX = pxX * zoom - subWidth / 2 - screenOffsetX
    const offsetY = pxY * zoom - subHeight / 2 + verticalShift - overlayOffsetY

    camera.setViewOffset(fullWidth, fullHeight, offsetX, offsetY, subWidth, subHeight)
    camera.zoom = 1
    camera.updateProjectionMatrix()

    renderer.setRenderTarget(this.aboutAsciiRenderTarget)

    scene.overrideMaterial = this.asciiMaterial
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(this.aboutAsciiRenderTarget, 0, 0, this.aboutAsciiCols, this.aboutAsciiRows, this.aboutAsciiContentBuffer)

    const asciiLinesData = []
    const obstacles = options.domObstacles || []

    for (let r = this.aboutAsciiRows - 1; r >= 0; r--) {
      const lineTop = (this.aboutAsciiRows - 1 - r) * CHAR_HEIGHT
      let rowChars = ''

      for (let c = 0; c < this.aboutAsciiCols; c++) {
        const absoluteScreenX = c * CHAR_WIDTH

        // --- 核心避让逻辑 ---

        // 1. Avoid the 3D silhouette using the full-screen mask buffer and neighbor sampling.
        // 使用字符中心采样，提高避障精度。
        const u = (absoluteScreenX + CHAR_WIDTH / 2) / window.innerWidth
        const v = 1 - ((lineTop + CHAR_HEIGHT / 2) / window.innerHeight)
        const mx = Math.floor(u * this.maskWidth)
        const my = Math.floor(v * this.maskHeight)

        let hitModel = false
        const searchRadius = options.modelSearchRadius ?? 2
        for (let sy = -searchRadius; sy <= searchRadius; sy++) {
          for (let sx = -searchRadius; sx <= searchRadius; sx++) {
            const curX = mx + sx
            const curY = my + sy
            if (curX >= 0 && curX < this.maskWidth && curY >= 0 && curY < this.maskHeight) {
              const maskIdx = (curY * this.maskWidth + curX) * 4
              if (this.maskBuffer[maskIdx]! > 20) {
                hitModel = true
                break
              }
            }
          }
          if (hitModel) break
        }

        if (hitModel) {
          rowChars += ' '
          continue
        }

        // 2. 避让 DOM 文本。
        let hitDom = false
        const paddingX = options.domPaddingX ?? 12
        const paddingY = options.domPaddingY ?? 2
        for (const rect of obstacles) {
          const charCenterX = absoluteScreenX + CHAR_WIDTH / 2
          const charCenterY = lineTop + CHAR_HEIGHT / 2
          if (
            charCenterX > rect.x - paddingX &&
            charCenterX < rect.x + rect.width + paddingX &&
            charCenterY > rect.y - paddingY &&
            charCenterY < rect.y + rect.height + paddingY
          ) {
            hitDom = true
            break
          }
        }
        if (hitDom) {
          rowChars += ' '
          continue
        }

        // 3. 生成字符。
        const pixelIdx = (r * this.aboutAsciiCols + c) * 4
        const brightness = (this.aboutAsciiContentBuffer[pixelIdx]! + this.aboutAsciiContentBuffer[pixelIdx + 1]! + this.aboutAsciiContentBuffer[pixelIdx + 2]!) / 3
        const proportion = brightness / 255.0
        const rampIdx = Math.min(MONO_RAMP.length - 1, Math.floor(proportion * MONO_RAMP.length))
        let ch = MONO_RAMP[rampIdx]!

        if (this.asciiVisibility < 1.0) {
          const key = r * 20000 + c // 放大 key，避免碰撞。
          let threshold = this.asciiCharThresholds.get(key)
          if (threshold === undefined) {
            threshold = Math.random() * 0.6 + 0.15
            this.asciiCharThresholds.set(key, threshold)
          }
          if (this.asciiVisibility < threshold) ch = ' '
        }
        rowChars += ch
      }
      asciiLinesData.push({ x: 0, y: lineTop, text: rowChars })
    }

    // 更新 DOM。
    while (this.asciiLinesPool.length < asciiLinesData.length) {
      const el = document.createElement('div')
      el.className = 'ascii-line'
      el.style.position = 'absolute'
      el.style.fontFamily = "'Courier New', Courier, monospace"
      el.style.fontSize = '18px'
      el.style.lineHeight = '18px'
      el.style.letterSpacing = '1px'
      el.style.color = 'var(--text-muted-color)'
      el.style.pointerEvents = 'none'
      el.style.whiteSpace = 'pre'
      asciiContainer.appendChild(el)
      this.asciiLinesPool.push(el)
    }
    while (this.asciiLinesPool.length > asciiLinesData.length) {
      const el = this.asciiLinesPool.pop()!
      el.remove()
    }
    for (let i = 0; i < asciiLinesData.length; i++) {
      const data = asciiLinesData[i]
      const el = this.asciiLinesPool[i]
      if (el && data) {
        el.textContent = data.text
        el.style.left = `${data.x}px`
        el.style.top = `${data.y}px`
      }
    }

    renderer.setRenderTarget(null)
    scene.background = prevBg
    scene.overrideMaterial = prevOverride
    groundMirror.visible = groundVis
    camera.clearViewOffset()
    camera.zoom = prevZoom
    camera.aspect = prevAspect
    camera.updateProjectionMatrix()
  }

  /** Subpage ASCII pass delegates to the full-screen ASCII renderer. */
  renderSubPageAsciiPass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    groundMirror: Reflector,
    asciiContainer: HTMLDivElement,
    options: SubPageAsciiOptions,
    model?: THREE.Object3D | null,
  ) {
    this.renderAboutAsciiPass(renderer, scene, camera, groundMirror, asciiContainer, options, model)
  }
  clearAsciiPool() {
    for (const el of this.asciiLinesPool) {
      el.remove()
    }
    this.asciiLinesPool = []
  }

  /**
   * ASCII dissolve animation: visibility goes from 1 to 0.
   * 动画期间 renderAsciiPass 仍逐帧运行，并自动应用可见度效果。
   */
  animateAsciiDissolve(duration = 1.0): Promise<void> {
    this.killAsciiTween()
    // Regenerate thresholds at animation start.
    this.asciiCharThresholds.clear()
    return new Promise((resolve) => {
      this.asciiVisibilityTween = gsap.to(this, {
        asciiVisibility: 0,
        duration,
        ease: 'power3.in',
        onComplete: () => {
          this.asciiVisibilityTween = null
          resolve()
        },
      })
    })
  }

  /**
   * ASCII materialize animation: visibility goes from 0 to 1.
   * 动画期间 renderAsciiPass 仍逐帧运行，并自动应用可见度效果。
   */
  animateAsciiMaterialize(duration = 1.0): Promise<void> {
    this.killAsciiTween()
    this.asciiVisibility = 0
    // Regenerate thresholds at animation start.
    this.asciiCharThresholds.clear()
    return new Promise((resolve) => {
      this.asciiVisibilityTween = gsap.to(this, {
        asciiVisibility: 1,
        duration,
        ease: 'power3.out',
        onComplete: () => {
          this.asciiVisibilityTween = null
          resolve()
        },
      })
    })
  }

  /** 立即设置 ASCII 可见度（无动画）。 */
  setAsciiVisibility(v: number) {
    this.killAsciiTween()
    this.asciiVisibility = v
  }

  private killAsciiTween() {
    if (this.asciiVisibilityTween) {
      this.asciiVisibilityTween.kill()
      this.asciiVisibilityTween = null
    }
  }

  /** Resize ASCII render targets after viewport changes. */
  onResize() {
    this.asciiCols = Math.floor((window.innerWidth / 2) / CHAR_WIDTH)
    this.asciiRows = Math.floor(window.innerHeight / CHAR_HEIGHT)
    this.asciiRenderTarget.setSize(this.asciiCols, this.asciiRows)
    this.readBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)
    this.asciiContentBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)

    const fullCols = Math.floor(window.innerWidth / CHAR_WIDTH)
    this.aboutAsciiCols = fullCols
    this.aboutAsciiRows = this.asciiRows
    this.aboutAsciiRenderTarget.setSize(this.aboutAsciiCols, this.aboutAsciiRows)
    this.aboutAsciiContentBuffer = new Uint8Array(this.aboutAsciiCols * this.aboutAsciiRows * 4)
  }

  dispose() {
    this.maskRenderTarget.dispose()
    this.maskMaterial.dispose()
    this.asciiRenderTarget.dispose()
    this.aboutAsciiRenderTarget.dispose()
    this.asciiMaterial.dispose()
  }
}

