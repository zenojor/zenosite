import * as THREE from 'three'
import gsap from 'gsap'
import { CAMERA_CONFIG } from '@/config/camera'
import type { PageName } from '@/router/pages'
import { TransitionController } from './TransitionController'

type CameraMode = 'orbit' | 'transitioning' | 'fixed'

interface CameraViewDef {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

/** Camera view definitions are read from CAMERA_CONFIG.views. */

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

  // Fixed 模式：当前 lookAt 目标，用于平滑过渡。
  private currentLookAt = new THREE.Vector3(0, 0, 0)

  private transitionController = new TransitionController()

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
    // 只有 orbit 模式下才允许拖拽。
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
   * @returns Promise that resolves when the transition completes.
   */
  transitionTo(page: PageName, duration = 0.8): Promise<void> {
    this.transitionController.cancel()

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

    if (duration <= 0) {
      this.camera.position.copy(view.position)
      this.currentLookAt.copy(view.lookAt)
      this.camera.lookAt(this.currentLookAt)
      this.mode = 'fixed'
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      // Tween 相机位置。
      const posTween = gsap.to(this.camera.position, {
        x: view.position.x,
        y: view.position.y,
        z: view.position.z,
        duration,
        ease: 'power3.inOut',
      })

      // Tween lookAt 目标。
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
          this.transitionController.complete()
        },
      })

      this.transitionController.track([posTween, lookAtTween], resolve, reject)
    })
  }

  private transitionToOrbit(duration: number): Promise<void> {
    this.mode = 'transitioning'
    this.isDragging = false

    // 计算目标轨道位置：从当前相机位置反算角度，确保无缝衔接。
    this.angle = Math.atan2(this.camera.position.z, this.camera.position.x)
    const targetPos = new THREE.Vector3(
      Math.cos(this.angle) * this.cameraDistance,
      this.cameraHeight,
      Math.sin(this.angle) * this.cameraDistance,
    )

    if (duration <= 0) {
      this.camera.position.copy(targetPos)
      this.currentLookAt.set(0, 0, 0)
      this.camera.lookAt(this.currentLookAt)
      this.mode = 'orbit'
      this.velocity = CAMERA_CONFIG.orbit.defaultVelocity
      this.canvas.style.cursor = 'grab'
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
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
          this.transitionController.complete()
        },
      })

      this.transitionController.track([posTween, lookAtTween], resolve, reject)
    })
  }

  /** 每帧更新。 */
  update() {
    if (this.mode === 'orbit') {
      // 保留轨道旋转和惯性逻辑。
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

      // Keep the current look target ready for future transitions.
      this.currentLookAt.set(0, 0, 0)
    }
    // transitioning and fixed modes are controlled by GSAP.
  }

  /** Get the current camera mode. */
  getMode(): CameraMode {
    return this.mode
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.transitionController.cancel()
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound)
    window.removeEventListener('pointermove', this.onPointerMoveBound)
    window.removeEventListener('pointerup', this.onPointerUpBound)
    window.removeEventListener('pointercancel', this.onPointerUpBound)
  }
}

