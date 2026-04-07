import * as THREE from 'three'
import gsap from 'gsap'
import type { PageName } from '../state/siteState'
import { CAMERA_CONFIG } from '../state/siteConfig'

type CameraMode = 'orbit' | 'transitioning' | 'fixed'

interface CameraViewDef {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

/** 相机视角定义从 siteConfig.ts 的 CAMERA_CONFIG.views 读取 */

export class CameraManager {
  camera: THREE.PerspectiveCamera

  // 当前模式
  private mode: CameraMode = 'orbit'

  // Orbit 模式参数
  private angle = 0
  private get cameraDistance() { return CAMERA_CONFIG.orbit.distance }
  private get cameraHeight() { return CAMERA_CONFIG.orbit.height }

  // 鼠标/触控拖拽控制
  private isDragging = false
  private previousX = 0
  private velocity = 0

  // Fixed 模式：当前 lookAt 目标（用于平滑过渡）
  private currentLookAt = new THREE.Vector3(0, 0, 0)

  // 活跃的 GSAP tween（用于取消）
  private activeTweens: gsap.core.Tween[] = []

  // Bound event handlers
  private readonly onPointerDownBound: (e: PointerEvent) => void
  private readonly onPointerMoveBound: (e: PointerEvent) => void
  private readonly onPointerUpBound: () => void
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new THREE.PerspectiveCamera(CAMERA_CONFIG.fov, window.innerWidth / window.innerHeight, 0.1, 1000)

    this.onPointerDownBound = this.onPointerDown.bind(this)
    this.onPointerMoveBound = this.onPointerMove.bind(this)
    this.onPointerUpBound = this.onPointerUp.bind(this)

    canvas.addEventListener('pointerdown', this.onPointerDownBound)
    window.addEventListener('pointermove', this.onPointerMoveBound)
    window.addEventListener('pointerup', this.onPointerUpBound)
    window.addEventListener('pointercancel', this.onPointerUpBound)

    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
  }

  private onPointerDown(e: PointerEvent) {
    // 只有 orbit 模式下才允许拖拽
    if (this.mode !== 'orbit') return
    this.isDragging = true
    this.previousX = e.clientX
    this.velocity = 0
  }

  private onPointerMove(e: PointerEvent) {
    if (this.isDragging && this.mode === 'orbit') {
      const deltaX = e.clientX - this.previousX
      this.angle += deltaX * 0.01
      this.velocity = deltaX * 0.01
      this.previousX = e.clientX
    }
  }

  private onPointerUp() {
    this.isDragging = false
  }

  /**
   * 平滑过渡到指定页面的相机视角。
   * @returns Promise，在转场完成后 resolve
   */
  transitionTo(page: PageName, duration = 0.8): Promise<void> {
    // 取消所有进行中的 tween
    this.killActiveTweens()

    if (page === 'home') {
      return this.transitionToOrbit(duration)
    }

    const viewDef = CAMERA_CONFIG.views[page]
    if (!viewDef) return Promise.resolve()
    const view: CameraViewDef = {
      position: new THREE.Vector3(viewDef.position.x, viewDef.position.y, viewDef.position.z),
      lookAt: new THREE.Vector3(viewDef.lookAt.x, viewDef.lookAt.y, viewDef.lookAt.z),
    }
    return this.transitionToFixed(view, duration)
  }

  private transitionToFixed(view: CameraViewDef, duration: number): Promise<void> {
    this.mode = 'transitioning'
    this.isDragging = false
    this.canvas.style.cursor = 'default'

    return new Promise((resolve) => {
      // Tween 相机位置
      const posTween = gsap.to(this.camera.position, {
        x: view.position.x,
        y: view.position.y,
        z: view.position.z,
        duration,
        ease: 'power3.inOut',
      })

      // Tween lookAt 目标
      const lookAtTween = gsap.to(this.currentLookAt, {
        x: view.lookAt.x,
        y: view.lookAt.y,
        z: view.lookAt.z,
        duration,
        ease: 'power3.inOut',
        onUpdate: () => {
          this.camera.lookAt(this.currentLookAt)
        },
        onComplete: () => {
          this.mode = 'fixed'
          this.activeTweens = []
          resolve()
        },
      })

      this.activeTweens = [posTween, lookAtTween]
    })
  }

  private transitionToOrbit(duration: number): Promise<void> {
    this.mode = 'transitioning'
    this.isDragging = false

    // 计算目标轨道位置（从当前角度继续，或使用合理的默认角度）
    // 从当前相机位置反算角度，确保无缝衔接
    this.angle = Math.atan2(this.camera.position.z, this.camera.position.x)
    const targetPos = new THREE.Vector3(
      Math.cos(this.angle) * this.cameraDistance,
      this.cameraHeight,
      Math.sin(this.angle) * this.cameraDistance,
    )

    return new Promise((resolve) => {
      const posTween = gsap.to(this.camera.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration,
        ease: 'power3.inOut',
      })

      const lookAtTween = gsap.to(this.currentLookAt, {
        x: 0,
        y: 0,
        z: 0,
        duration,
        ease: 'power3.inOut',
        onUpdate: () => {
          this.camera.lookAt(this.currentLookAt)
        },
        onComplete: () => {
          this.mode = 'orbit'
          this.velocity = CAMERA_CONFIG.orbit.defaultVelocity
          this.canvas.style.cursor = 'grab'
          this.activeTweens = []
          resolve()
        },
      })

      this.activeTweens = [posTween, lookAtTween]
    })
  }

  private killActiveTweens() {
    for (const tween of this.activeTweens) {
      tween.kill()
    }
    this.activeTweens = []
  }

  /** 每帧更新 */
  update() {
    if (this.mode === 'orbit') {
      // 完全保留原始的轨道旋转 + 惯性逻辑
      if (this.isDragging) {
        this.canvas.style.cursor = 'grabbing'
        this.velocity *= 0.5
      } else {
        this.canvas.style.cursor = 'grab'
        this.angle += this.velocity
        this.velocity += (CAMERA_CONFIG.orbit.defaultVelocity - this.velocity) * 0.05
      }

      this.camera.position.x = Math.cos(this.angle) * this.cameraDistance
      this.camera.position.z = Math.sin(this.angle) * this.cameraDistance
      this.camera.position.y = this.cameraHeight
      this.camera.lookAt(0, 0, 0)

      // 同步 currentLookAt 以备后续转场时的起始值
      this.currentLookAt.set(0, 0, 0)
    }
    // transitioning 和 fixed 模式下由 GSAP 控制，不做额外计算
    // fixed 模式中 camera.lookAt 已在最后一次 onUpdate 中设置
  }

  /** 获取当前模式 */
  getMode(): CameraMode {
    return this.mode
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.killActiveTweens()
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound)
    window.removeEventListener('pointermove', this.onPointerMoveBound)
    window.removeEventListener('pointerup', this.onPointerUpBound)
    window.removeEventListener('pointercancel', this.onPointerUpBound)
  }
}
