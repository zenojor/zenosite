import * as THREE from 'three'
import { watch } from 'vue'
import gsap from 'gsap'
import { CameraManager } from './CameraManager'
import { World } from './World'
import { EffectManager } from './EffectManager'
import { LayoutManager } from './LayoutManager'
import { TextAnimator } from './TextAnimator'
import { activePage, type PageName } from '../state/siteState'

export interface ExperienceDOMRefs {
  canvas: HTMLCanvasElement
  asciiContainer: HTMLDivElement
  dynamicLayoutContainer: HTMLDivElement
  navContainer: HTMLDivElement | null
  backButton: HTMLDivElement | null
}

export class Experience {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private clock: THREE.Clock

  private cameraManager: CameraManager
  private world: World
  private effectManager: EffectManager
  private layoutManager: LayoutManager

  private animationId: number | null = null
  private domRefs: ExperienceDOMRefs

  private currentPage: PageName = 'home'
  private isTransitioning = false
  private runHomeDuringTransition = false
  private runAboutDuringTransition = false

  private stopWatcher: (() => void) | null = null

  constructor(refs: ExperienceDOMRefs) {
    this.domRefs = refs

    this.scene = new THREE.Scene()
    this.renderer = new THREE.WebGLRenderer({ canvas: refs.canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0xffffff, 0)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)

    this.clock = new THREE.Clock()

    this.cameraManager = new CameraManager(refs.canvas)
    this.world = new World(this.scene)
    this.effectManager = new EffectManager()
    this.layoutManager = new LayoutManager()

    this.stopWatcher = watch(activePage, (newPage, oldPage) => {
      if (newPage !== oldPage && !this.isTransitioning) {
        this.handlePageTransition(oldPage, newPage)
      }
    })

    // 根据初始状态设置 UI 可见性
    if (activePage.value !== 'home') {
      this.currentPage = activePage.value
      // 如果初始就在子页，隐藏主页导航，显示 Back
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'none'
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'block'
    } else {
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'none'
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'flex'
    }

    window.addEventListener('resize', this.onResize)
    this.animate()
  }

  private async handlePageTransition(from: PageName, to: PageName) {
    if (this.isTransitioning) return
    this.isTransitioning = true

    const navSpans = Array.from(this.domRefs.navContainer?.querySelectorAll('span') || []) as unknown as HTMLDivElement[]
    const navTexts = ['About', 'Experience', 'Projects', 'Contact']
    const backBtn = this.domRefs.backButton

    if (from === 'home') {
      this.runHomeDuringTransition = true
      await Promise.all([
        this.layoutManager.animateHomeDissolve(1.0),
        this.effectManager.animateAsciiDissolve(1.0),
        TextAnimator.dissolve(navSpans, 0.8),
      ])
      this.runHomeDuringTransition = false
      this.effectManager.clearAsciiPool()

      await this.cameraManager.transitionTo(to, 1.2)
      this.currentPage = to

      if (to !== 'home') {
        this.runAboutDuringTransition = true
        this.layoutManager.updateAbout(this.domRefs.dynamicLayoutContainer, this.effectManager)
        
        const elements = this.layoutManager.getAboutElements()
        const texts = this.layoutManager.getAboutTexts()
        const badgeContainer = this.layoutManager.getBadgeContainer()
        if (badgeContainer) badgeContainer.style.opacity = '0'

        await Promise.all([
          TextAnimator.materialize(elements, texts, 1.0),
          this.effectManager.animateAsciiMaterialize(1.0),
          backBtn ? TextAnimator.materialize([backBtn], ['[ Back ]'], 0.8) : Promise.resolve(),
        ])
        if (badgeContainer) gsap.to(badgeContainer, { opacity: 1, duration: 0.8, ease: 'power3.out' })
        this.runAboutDuringTransition = false
      }
    } else if (to === 'home') {
      // 1. 消散子页（补充 ASCII 消散动画）
      this.runAboutDuringTransition = true
      const elements = this.layoutManager.getAboutElements()
      const badgeContainer = this.layoutManager.getBadgeContainer()
      await Promise.all([
        TextAnimator.dissolve(elements, 1.0),
        this.effectManager.animateAsciiDissolve(1.0),
        backBtn ? TextAnimator.dissolve([backBtn], 0.8) : Promise.resolve(),
        badgeContainer ? gsap.to(badgeContainer, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
      ])
      this.runAboutDuringTransition = false
      this.layoutManager.clearAbout()
      this.effectManager.clearAsciiPool()

      // 2. 回到主页相机
      await this.cameraManager.transitionTo('home', 1.2)
      this.currentPage = 'home'

      // 3. 重现主页 (文字 + ASCII + 导航按钮)
      this.runHomeDuringTransition = true
      await Promise.all([
        this.layoutManager.animateHomeMaterialize(1.0),
        this.effectManager.animateAsciiMaterialize(1.0),
        TextAnimator.materialize(navSpans, navTexts, 0.8),
      ])
      this.runHomeDuringTransition = false
    } else {
      // 页面间切换（子页面之间）
      this.runAboutDuringTransition = true
      const elementsOld = this.layoutManager.getAboutElements()
      const badgeContainerOld = this.layoutManager.getBadgeContainer()
      await Promise.all([
        TextAnimator.dissolve(elementsOld, 1.0),
        this.effectManager.animateAsciiDissolve(1.0),
        badgeContainerOld ? gsap.to(badgeContainerOld, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
      ])
      this.runAboutDuringTransition = false
      this.layoutManager.clearAbout()
      this.effectManager.clearAsciiPool()

      await this.cameraManager.transitionTo(to, 1.2)
      this.currentPage = to

      this.runAboutDuringTransition = true
      this.layoutManager.updateAbout(this.domRefs.dynamicLayoutContainer, this.effectManager)
      
      const elementsNew = this.layoutManager.getAboutElements()
      const textsNew = this.layoutManager.getAboutTexts()
      const badgeContainerNew = this.layoutManager.getBadgeContainer()
      if (badgeContainerNew) badgeContainerNew.style.opacity = '0'

      await Promise.all([
        TextAnimator.materialize(elementsNew, textsNew, 1.0),
        this.effectManager.animateAsciiMaterialize(1.0),
      ])
      if (badgeContainerNew) gsap.to(badgeContainerNew, { opacity: 1, duration: 0.8, ease: 'power3.out' })
      this.runAboutDuringTransition = false
    }

    this.isTransitioning = false
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()

    this.world.update(delta)
    this.cameraManager.update()
    const camera = this.cameraManager.camera

    // 1. 全屏剪影（用于规避实际人物位置）
    this.effectManager.renderSilhouettePass(this.renderer, this.scene, camera, this.world.groundMirror)

    const isHome = (this.currentPage === 'home' && !this.isTransitioning) || (this.isTransitioning && this.runHomeDuringTransition)
    const isAbout = (this.currentPage !== 'home' && !this.isTransitioning) || (this.isTransitioning && this.runAboutDuringTransition)

    // 2. 主页布局
    if (isHome) {
      if (this.domRefs.dynamicLayoutContainer) {
        this.layoutManager.update(this.domRefs.dynamicLayoutContainer, this.domRefs.navContainer, this.effectManager)
      }
    }

    // 3. ASCII 渲染（Home 用半屏版，About 用独立全屏版）
    if (isHome) {
      if (this.domRefs.asciiContainer) {
        this.effectManager.renderAsciiPass(
          this.renderer,
          this.scene,
          camera,
          this.world.groundMirror,
          this.domRefs.asciiContainer,
          { mode: 'home', domObstacles: [] },
          this.world.model
        )
      }
    } else if (isAbout) {
      if (this.domRefs.asciiContainer) {
        this.effectManager.renderAboutAsciiPass(
          this.renderer,
          this.scene,
          camera,
          this.world.groundMirror,
          this.domRefs.asciiContainer,
          { domObstacles: this.layoutManager.getAboutRects() },
          this.world.model
        )
      }
    }

    // 4. About 布局避障
    if (this.currentPage !== 'home' && !this.isTransitioning) {
      this.layoutManager.updateAbout(this.domRefs.dynamicLayoutContainer, this.effectManager)
    }

    this.renderer.render(this.scene, camera)
  }

  private onResize = () => {
    this.cameraManager.onResize()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.world.onResize()
    this.effectManager.onResize()
  }

  dispose() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    if (this.stopWatcher) this.stopWatcher()
    window.removeEventListener('resize', this.onResize)
    this.cameraManager.dispose()
    this.effectManager.dispose()
    this.renderer.dispose()
  }
}
