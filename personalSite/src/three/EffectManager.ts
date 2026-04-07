import * as THREE from 'three'
import type { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import gsap from 'gsap'

// ASCII Config
const MONO_RAMP = ' .`-_:,;^=+/|)\\!?0oOQ#%@'
const CHAR_WIDTH = 11.8 // Approximate width of 18px Courier New (10.8) + 1px letter-spacing
const CHAR_HEIGHT = 18 // 18px line-height
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
  mode: 'home' | 'subpage'
  domObstacles?: Rect[]
}

export class EffectManager {
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

  // Dedicated SubPage ASCII (Full Screen)
  private subPageAsciiCols: number
  private subPageAsciiRows: number
  private subPageAsciiRenderTarget: THREE.WebGLRenderTarget
  private subPageAsciiContentBuffer: Uint8Array

  private asciiLinesPool: HTMLDivElement[] = []
  private domObstacles: Rect[] = []

  /**
   * ASCII 鍙搴﹁繘搴︼細0 = 瀹屽叏涓嶅彲瑙侊紙绌烘牸锛夛紝1 = 瀹屽叏鍙锛堟甯告覆鏌擄級銆?   * 鍦?0~1 涔嬮棿鏃朵細瀵规瘡涓瓧绗﹀簲鐢ㄩ殢鏈哄瓧绗︽浛鎹㈡晥鏋溿€?   */
  private asciiVisibility = 1.0
  private asciiVisibilityTween: gsap.core.Tween | null = null
  /**
   * ASCII 瀛楃鐨勫浐瀹氶殢鏈洪槇鍊肩紦瀛樸€?   * Key = "row,col", Value = 闃堝€笺€?   * 浠呭湪鍔ㄧ敾寮€濮嬫椂閲嶆柊鐢熸垚銆?   */
  private asciiCharThresholds: Map<number, number> = new Map()

  constructor() {
    // Silhouette Mask for Dynamic Layout
    this.maskRenderTarget = new THREE.WebGLRenderTarget(this.maskWidth, this.maskHeight)
    this.maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.maskBuffer = new Uint8Array(this.maskWidth * this.maskHeight * 4)

    // Configure ASCII render target (鍒濆榛樿涓哄乏鍗婂睆)
    this.asciiCols = Math.floor((window.innerWidth / 2) / CHAR_WIDTH)
    this.asciiRows = Math.floor(window.innerHeight / CHAR_HEIGHT)
    this.asciiRenderTarget = new THREE.WebGLRenderTarget(this.asciiCols, this.asciiRows)
    this.asciiMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.readBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)
    this.asciiContentBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)

    // Full Screen SubPage ASCII Initialize
    const fullCols = Math.floor(window.innerWidth / CHAR_WIDTH)
    this.subPageAsciiCols = fullCols
    this.subPageAsciiRows = this.asciiRows
    this.subPageAsciiRenderTarget = new THREE.WebGLRenderTarget(this.subPageAsciiCols, this.subPageAsciiRows)
    this.subPageAsciiContentBuffer = new Uint8Array(this.subPageAsciiCols * this.subPageAsciiRows * 4)
  }

  /** 璁剧疆棰濆鐨?DOM 闅滅鐗╋紙濡?About 鏂囨鍖哄煙锛?*/
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

    // --- 鐩告満 鎶曞奖鐭╅樀骞崇Щ (View Offset) 鏍稿績閫昏緫 ---

    // 1. Project model center to screen-space
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()

    const projectionTarget = new THREE.Vector3(0, 0, 0)
    if (options.mode === 'subpage' && model) {
      model.updateMatrixWorld()
      const box = new THREE.Box3().setFromObject(model)
      box.getCenter(projectionTarget)
    }

    const modelProjected = projectionTarget.clone().project(camera)
    const pxX = (modelProjected.x * 0.5 + 0.5) * window.innerWidth
    const pxY = (1 - (modelProjected.y * 0.5 + 0.5)) * window.innerHeight

    // 2. 璁＄畻瑙嗗浘鍋忕Щ (View Offset)
    const zoom = 4.0
    // 娉ㄦ剰锛氳繖閲岀殑 subWidth / subHeight 蹇呴』绗﹀悎娓叉煋鐩爣鐨勬瘮渚?(0.5)锛屽惁鍒欎細鎷変几
    const subWidth = (window.innerWidth / 2) / zoom
    const subHeight = window.innerHeight / zoom
    // 鎴戜滑甯屾湜妯″瀷鎶曞奖鐐?(pxX, pxY) 澶勪簬瀛愯鍙ｇ殑涓績
    const offsetX = pxX - subWidth / 2
    const offsetY = pxY - subHeight / 2

    // Apply camera view offset.
    camera.setViewOffset(window.innerWidth, window.innerHeight, offsetX, offsetY, subWidth, subHeight)
    // 閲嶇疆棰濆 zoom
    camera.zoom = 1
    camera.updateProjectionMatrix()

    renderer.setRenderTarget(this.asciiRenderTarget)

    // Render low-res scene for ASCII conversion.
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(this.asciiRenderTarget, 0, 0, this.asciiCols, this.asciiRows, this.asciiContentBuffer)

    const asciiLinesData = []
    const obstacles = options.domObstacles || this.domObstacles

    // 鍏充簬椤?ASCII 鍦ㄥ睆骞曟涓ぎ鏄剧ず鐨勫亸绉婚噺
    const canvasWidth = this.asciiCols * CHAR_WIDTH
    const screenOffsetX = options.mode === 'home' ? 0 : Math.floor((window.innerWidth - canvasWidth) / 2)

    const fullCols = Math.floor(window.innerWidth / CHAR_WIDTH)

    for (let r = this.asciiRows - 1; r >= 0; r--) {
      const lineTop = (this.asciiRows - 1 - r) * CHAR_HEIGHT
      const limits = this.getObstacleLimits(lineTop, CHAR_HEIGHT)

      // 3D 杞粨杈圭晫妫€娴?(浠?Home 妯″紡浣跨敤绠€鍗曠殑宸︿晶鎴柇閫昏緫)
      let limitCol = this.asciiCols
      if (options.mode === 'home') {
        if (limits.modelLeft < window.innerWidth) {
          const padding = 16
          const nextLimitCol = Math.floor((limits.modelLeft - padding) / CHAR_WIDTH)
          if (nextLimitCol > 0 && nextLimitCol < this.asciiCols) {
            limitCol = nextLimitCol
          }
        }
      }

      let rowChars = ''
      for (let c = 0; c < this.asciiCols; c++) {
        const absoluteScreenPointX = screenOffsetX + c * CHAR_WIDTH

        // 1. 瑙勯伩 3D 杞粨 (Home 妯″紡宸︿晶閫昏緫)
        if (options.mode === 'home' && c > limitCol) {
          break
        }

        // 2. Avoid model in subpage mode
        const u = (absoluteScreenPointX + CHAR_WIDTH / 2) / window.innerWidth
        const v = 1 - ((lineTop + CHAR_HEIGHT / 2) / window.innerHeight)
        const mx = Math.floor(u * this.maskWidth)
        const my = Math.floor(v * this.maskHeight)

        if (options.mode === 'subpage' && mx >= 0 && mx < this.maskWidth && my >= 0 && my < this.maskHeight) {
          const maskIdx = (my * this.maskWidth + mx) * 4
          if (this.maskBuffer[maskIdx]! > 20) {
            rowChars += ' '
            continue
          }
        }

        // 3. 瑙勯伩 DOM 闅滅鐗?(About 鏂囨绛?
        let hitDom = false
        const horizontalPadding = 10
        const verticalPadding = 2
        for (const rect of obstacles) {
          if (
            absoluteScreenPointX > rect.x - horizontalPadding &&
            absoluteScreenPointX < rect.x + rect.width + horizontalPadding &&
            lineTop > rect.y - verticalPadding &&
            lineTop < rect.y + rect.height + verticalPadding
          ) {
            hitDom = true
            break
          }
        }

        if (hitDom) {
          rowChars += ' '
          continue
        }

        // 4. 杞崲鐪熷疄鐨勫満鏅寒搴︿负瀛楃
        const pixelIdx = (r * this.asciiCols + c) * 4
        const brightness = (this.asciiContentBuffer[pixelIdx]! + this.asciiContentBuffer[pixelIdx + 1]! + this.asciiContentBuffer[pixelIdx + 2]!) / 3
        const proportion = brightness / 255.0
        const rampIdx = Math.min(MONO_RAMP.length - 1, Math.floor(proportion * MONO_RAMP.length))
        let ch = MONO_RAMP[rampIdx]!

        // Visibility effect
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
      asciiLinesData.push({ x: screenOffsetX, y: lineTop, text: rowChars })
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
      el.style.color = 'rgba(0, 0, 0, 0.65)'
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

    // Clear view offset and restore camera projection.
    camera.clearViewOffset()
    camera.zoom = prevZoom
    camera.aspect = prevAspect
    camera.updateProjectionMatrix()
  }

  /** SubPage Pass: FULL SCREEN version specifically for瀛愰〉闈紝涓庝富椤甸€昏緫褰诲簳闅旂 */
  renderSubPageAsciiPass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    groundMirror: Reflector,
    asciiContainer: HTMLDivElement,
    options: { domObstacles: Rect[] },
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

    // 1. 鑾峰彇杩借釜鐩爣涓績
    const projectionTarget = new THREE.Vector3(0, 0, 0)
    if (model) {
      model.updateMatrixWorld()
      const box = new THREE.Box3().setFromObject(model)
      box.getCenter(projectionTarget)
    }

    const modelProjected = projectionTarget.clone().project(camera)
    const pxX = (modelProjected.x * 0.5 + 0.5) * window.innerWidth
    const pxY = (1 - (modelProjected.y * 0.5 + 0.5)) * window.innerHeight

    // 2. 璁＄畻瑙嗗浘鍋忕Щ (2.0x 鍏ㄥ睆瑁佸壀锛屼笉浜х敓鎴柇)
    const zoom = 2.0
    const fullWidth = window.innerWidth * zoom
    const fullHeight = window.innerHeight * zoom
    const subWidth = window.innerWidth
    const subHeight = window.innerHeight

    // 鎴戜滑甯屾湜 pxX * zoom (鏀惧ぇ鐨勬姇褰辩偣) 澶勪簬 subWidth (瑙嗗彛绐楀彛) 鐨勪腑蹇?    // 澧炲姞涓€涓瀭鐩村亸绉婚噺 (15% 灞忓箷楂樺害) 浠ュ皢浜虹墿鍥惧儚鍚戜笂绉诲姩
    const verticalShift = window.innerHeight * 0.15
    const offsetX = pxX * zoom - subWidth / 2
    const offsetY = pxY * zoom - subHeight / 2 + verticalShift

    camera.setViewOffset(fullWidth, fullHeight, offsetX, offsetY, subWidth, subHeight)
    camera.zoom = 1
    camera.updateProjectionMatrix()

    renderer.setRenderTarget(this.subPageAsciiRenderTarget)

    // Render full-screen subpage ASCII source.
    scene.overrideMaterial = this.asciiMaterial
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(this.subPageAsciiRenderTarget, 0, 0, this.subPageAsciiCols, this.subPageAsciiRows, this.subPageAsciiContentBuffer)

    const asciiLinesData = []
    const obstacles = options.domObstacles

    // Full-screen mode: no horizontal offset
    const screenOffsetX = 0

    for (let r = this.subPageAsciiRows - 1; r >= 0; r--) {
      const lineTop = (this.subPageAsciiRows - 1 - r) * CHAR_HEIGHT
      let rowChars = ''

      for (let c = 0; c < this.subPageAsciiCols; c++) {
        const absoluteScreenX = c * CHAR_WIDTH

        // --- 鏍稿績瑙勯伩閫昏緫 ---

        // 1. 瑙勯伩 3D 杞粨 (鍩轰簬鍏ㄥ睆 maskBuffer锛屽苟澧炲姞閭诲煙妫€娴嬪疄鐜?Padding)
        // 浣跨敤瀛楃涓績閲囨牱锛屾彁楂橀伩闅滅簿鍑嗗害
        const u = (absoluteScreenX + CHAR_WIDTH / 2) / window.innerWidth
        const v = 1 - ((lineTop + CHAR_HEIGHT / 2) / window.innerHeight)
        const mx = Math.floor(u * this.maskWidth)
        const my = Math.floor(v * this.maskHeight)

        let hitModel = false
        const searchRadius = 2 // 5x5 閭诲煙锛屼负浜虹墿鎻愪緵绾?1 瀛楃瀹界殑淇濇姢杈硅窛
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

        // 2. 瑙勯伩 DOM 鏂囨
        let hitDom = false
        const paddingX = 12
        const paddingY = 2
        for (const rect of obstacles) {
          if (
            absoluteScreenX > rect.x - paddingX &&
            absoluteScreenX < rect.x + rect.width + paddingX &&
            lineTop > rect.y - paddingY &&
            lineTop < rect.y + rect.height + paddingY
          ) {
            hitDom = true
            break
          }
        }
        if (hitDom) {
          rowChars += ' '
          continue
        }

        // 3. 鐢熸垚瀛楃閫昏緫
        const pixelIdx = (r * this.subPageAsciiCols + c) * 4
        const brightness = (this.subPageAsciiContentBuffer[pixelIdx]! + this.subPageAsciiContentBuffer[pixelIdx + 1]! + this.subPageAsciiContentBuffer[pixelIdx + 2]!) / 3
        const proportion = brightness / 255.0
        const rampIdx = Math.min(MONO_RAMP.length - 1, Math.floor(proportion * MONO_RAMP.length))
        let ch = MONO_RAMP[rampIdx]!

        if (this.asciiVisibility < 1.0) {
          const key = r * 20000 + c // 澧炲ぇ Key 闃叉纰版挒
          let threshold = this.asciiCharThresholds.get(key)
          if (threshold === undefined) {
            threshold = Math.random() * 0.6 + 0.15
            this.asciiCharThresholds.set(key, threshold)
          }
          if (this.asciiVisibility < threshold) ch = ' '
        }
        rowChars += ch
      }
      asciiLinesData.push({ x: screenOffsetX, y: lineTop, text: rowChars })
    }

    // 鏇存柊 DOM
    while (this.asciiLinesPool.length < asciiLinesData.length) {
      const el = document.createElement('div')
      el.className = 'ascii-line'
      el.style.position = 'absolute'
      el.style.fontFamily = "'Courier New', Courier, monospace"
      el.style.fontSize = '18px'
      el.style.lineHeight = '18px'
      el.style.letterSpacing = '1px'
      el.style.color = 'rgba(0, 0, 0, 0.65)'
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

  /** 娓呴櫎 ASCII DOM 姹狅紙鐢ㄤ簬杞満鍚庨噸鏂扮敓鎴愬叏鏂板厓绱狅級 */
  clearAsciiPool() {
    for (const el of this.asciiLinesPool) {
      el.remove()
    }
    this.asciiLinesPool = []
  }

  /**
   * ASCII 娑堟暎鍔ㄧ敾锛氬彲瑙佸害浠?1 鈫?0
   * 鍦ㄥ姩鐢绘湡闂达紝renderAsciiPass 姣忓抚浠嶅湪杩愯锛屼細鑷姩搴旂敤鏁堟灉
   */
  animateAsciiDissolve(duration = 1.0): Promise<void> {
    this.killAsciiTween()
    // Rebuild randomized thresholds at the start of dissolve.
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
   * ASCII 閲嶇幇鍔ㄧ敾锛氬彲瑙佸害浠?0 鈫?1
   * 鍦ㄥ姩鐢绘湡闂达紝renderAsciiPass 姣忓抚浠嶅湪杩愯锛屼細鑷姩搴旂敤鏁堟灉
   */
  animateAsciiMaterialize(duration = 1.0): Promise<void> {
    this.killAsciiTween()
    this.asciiVisibility = 0
    // Rebuild randomized thresholds at the start of materialize.
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

  /** 绔嬪嵆璁剧疆 ASCII 鍙搴︼紙鏃犲姩鐢伙級 */
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

  /** 绐楀彛缂╂斁鏃舵洿鏂?ASCII 娓叉煋鐩爣灏哄 */
  onResize() {
    this.asciiCols = Math.floor((window.innerWidth / 2) / CHAR_WIDTH)
    this.asciiRows = Math.floor(window.innerHeight / CHAR_HEIGHT)
    this.asciiRenderTarget.setSize(this.asciiCols, this.asciiRows)
    this.readBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)
    this.asciiContentBuffer = new Uint8Array(this.asciiCols * this.asciiRows * 4)

    const fullCols = Math.floor(window.innerWidth / CHAR_WIDTH)
    this.subPageAsciiCols = fullCols
    this.subPageAsciiRows = this.asciiRows
    this.subPageAsciiRenderTarget.setSize(this.subPageAsciiCols, this.subPageAsciiRows)
    this.subPageAsciiContentBuffer = new Uint8Array(this.subPageAsciiCols * this.subPageAsciiRows * 4)
  }

  dispose() {
    this.maskRenderTarget.dispose()
    this.maskMaterial.dispose()
    this.asciiRenderTarget.dispose()
    this.subPageAsciiRenderTarget.dispose()
    this.asciiMaterial.dispose()
  }
}

