import * as THREE from 'three'
import gsap from 'gsap'
import { CAMERA_CONFIG } from '@/config/camera'
import type { PageName } from '@/router/pages'

type CameraMode = 'orbit' | 'transitioning' | 'fixed'

interface CameraViewDef {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

/** Camera view definitions are read from CAMERA_CONFIG.views. */

export class CameraManager {
  camera: THREE.PerspectiveCamera

  // 褰撳墠妯″紡
  private mode: CameraMode = 'orbit'

  // Orbit 妯″紡鍙傛暟
  private angle = 0
  private get cameraDistance() { return CAMERA_CONFIG.orbit.distance }
  private get cameraHeight() { return CAMERA_CONFIG.orbit.height }

  // 榧犳爣/瑙︽帶鎷栨嫿鎺у埗
  private isDragging = false
  private previousX = 0
  private velocity = 0

  // Fixed 妯″紡锛氬綋鍓?lookAt 鐩爣锛堢敤浜庡钩婊戣繃娓★級
  private currentLookAt = new THREE.Vector3(0, 0, 0)

  // 娲昏穬鐨?GSAP tween锛堢敤浜庡彇娑堬級
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
    // 鍙湁 orbit 妯″紡涓嬫墠鍏佽鎷栨嫿
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
   * 骞虫粦杩囨浮鍒版寚瀹氶〉闈㈢殑鐩告満瑙嗚銆?   * @returns Promise锛屽湪杞満瀹屾垚鍚?resolve
   */
  transitionTo(page: PageName, duration = 0.8): Promise<void> {
    // 鍙栨秷鎵€鏈夎繘琛屼腑鐨?tween
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
      // Tween 鐩告満浣嶇疆
      const posTween = gsap.to(this.camera.position, {
        x: view.position.x,
        y: view.position.y,
        z: view.position.z,
        duration,
        ease: 'power3.inOut',
      })

      // Tween lookAt 鐩爣
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

    // 璁＄畻鐩爣杞ㄩ亾浣嶇疆锛堜粠褰撳墠瑙掑害缁х画锛屾垨浣跨敤鍚堢悊鐨勯粯璁よ搴︼級
    // 浠庡綋鍓嶇浉鏈轰綅缃弽绠楄搴︼紝纭繚鏃犵紳琛旀帴
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

  /** 姣忓抚鏇存柊 */
  update() {
    if (this.mode === 'orbit') {
      // 瀹屽叏淇濈暀鍘熷鐨勮建閬撴棆杞?+ 鎯€ч€昏緫
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
    this.killActiveTweens()
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound)
    window.removeEventListener('pointermove', this.onPointerMoveBound)
    window.removeEventListener('pointerup', this.onPointerUpBound)
    window.removeEventListener('pointercancel', this.onPointerUpBound)
  }
}

