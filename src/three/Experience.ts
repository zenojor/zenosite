import * as THREE from 'three'
import { watch } from 'vue'
import gsap from 'gsap'
import { CameraManager } from './CameraManager'
import { World } from './World'
import { EffectManager } from './EffectManager'
import { LayoutManager } from './LayoutManager'
import { TextAnimator } from './TextAnimator'
import { activePage, type PageName } from '../state/siteState'
import { ASCII_CONFIG, responsive } from '../state/siteConfig'

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
  private runSubPageDuringTransition = false

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

    // Initialize UI visibility from current page state.
    if (activePage.value !== 'home') {
      this.currentPage = activePage.value
      // 濡傛灉鍒濆灏卞湪瀛愰〉锛岄殣钘忎富椤靛鑸紝鏄剧ず Back
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
        this.runSubPageDuringTransition = true
        this.layoutManager.updateSubPage(to, this.domRefs.dynamicLayoutContainer, this.effectManager)

        const elements = this.layoutManager.getSubPageElements()
        const texts = this.layoutManager.getSubPageTexts()
        const badgeContainer = this.layoutManager.getBadgeContainer()
        const socialBadgeContainer = this.layoutManager.getSocialBadgeContainer()
        if (badgeContainer) badgeContainer.style.opacity = '0'
        if (socialBadgeContainer) socialBadgeContainer.style.opacity = '0'

        await Promise.all([
          TextAnimator.materialize(elements, texts, 1.0),
          this.effectManager.animateAsciiMaterialize(1.0),
          backBtn ? TextAnimator.materialize([backBtn], ['[ Back ]'], 0.8) : Promise.resolve(),
        ])
        if (badgeContainer) gsap.to(badgeContainer, { opacity: 1, duration: 0.8, ease: 'power3.out' })
        if (socialBadgeContainer) gsap.to(socialBadgeContainer, { opacity: 1, duration: 0.8, ease: 'power3.out' })
        this.runSubPageDuringTransition = false
      }
    } else if (to === 'home') {
      // 1. 娑堟暎瀛愰〉 (鎵€鏈夐潪 Home 椤甸潰)
      this.runSubPageDuringTransition = true
      const elements = this.layoutManager.getSubPageElements()
      const badgeContainer = this.layoutManager.getBadgeContainer()
      const socialBadgeContainer = this.layoutManager.getSocialBadgeContainer()
      await Promise.all([
        TextAnimator.dissolve(elements, 1.0),
        this.effectManager.animateAsciiDissolve(1.0),
        backBtn ? TextAnimator.dissolve([backBtn], 0.8) : Promise.resolve(),
        badgeContainer ? gsap.to(badgeContainer, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
        socialBadgeContainer ? gsap.to(socialBadgeContainer, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
      ])
      this.runSubPageDuringTransition = false
      this.layoutManager.clearSubPage()
      this.effectManager.clearAsciiPool()

      // 2. 鍥炲埌涓婚〉鐩告満
      await this.cameraManager.transitionTo('home', 1.2)
      this.currentPage = 'home'

      // 3. 閲嶇幇涓婚〉 (鏂囧瓧 + ASCII + 瀵艰埅鎸夐挳)
      this.runHomeDuringTransition = true
      await Promise.all([
        this.layoutManager.animateHomeMaterialize(1.0),
        this.effectManager.animateAsciiMaterialize(1.0),
        TextAnimator.materialize(navSpans, navTexts, 0.8),
      ])
      this.runHomeDuringTransition = false
    } else {
      // 椤甸潰闂村垏鎹紙瀛愰〉闈箣闂达級
      this.runSubPageDuringTransition = true
      const elementsOld = this.layoutManager.getSubPageElements()
      const badgeContainerOld = this.layoutManager.getBadgeContainer()
      const socialBadgeContainerOld = this.layoutManager.getSocialBadgeContainer()
      await Promise.all([
        TextAnimator.dissolve(elementsOld, 1.0),
        this.effectManager.animateAsciiDissolve(1.0),
        badgeContainerOld ? gsap.to(badgeContainerOld, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
        socialBadgeContainerOld ? gsap.to(socialBadgeContainerOld, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
      ])
      this.runSubPageDuringTransition = false
      this.layoutManager.clearSubPage()
      this.effectManager.clearAsciiPool()

      await this.cameraManager.transitionTo(to, 1.2)
      this.currentPage = to

      this.runSubPageDuringTransition = true
      this.layoutManager.updateSubPage(to, this.domRefs.dynamicLayoutContainer, this.effectManager)

      const elementsNew = this.layoutManager.getSubPageElements()
      const textsNew = this.layoutManager.getSubPageTexts()
      const badgeContainerNew = this.layoutManager.getBadgeContainer()
      const socialBadgeContainerNew = this.layoutManager.getSocialBadgeContainer()
      if (badgeContainerNew) badgeContainerNew.style.opacity = '0'
      if (socialBadgeContainerNew) socialBadgeContainerNew.style.opacity = '0'

      await Promise.all([
        TextAnimator.materialize(elementsNew, textsNew, 1.0),
        this.effectManager.animateAsciiMaterialize(1.0),
      ])
      if (badgeContainerNew) gsap.to(badgeContainerNew, { opacity: 1, duration: 0.8, ease: 'power3.out' })
      if (socialBadgeContainerNew) gsap.to(socialBadgeContainerNew, { opacity: 1, duration: 0.8, ease: 'power3.out' })
      this.runSubPageDuringTransition = false
    }

    this.isTransitioning = false
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()

    this.world.update(delta)
    this.cameraManager.update()
    const camera = this.cameraManager.camera

    // 1. 鍏ㄥ睆鍓奖锛堢敤浜庤閬垮疄闄呬汉鐗╀綅缃級
    this.effectManager.renderSilhouettePass(this.renderer, this.scene, camera, this.world.groundMirror)

    const isHome = (this.currentPage === 'home' && !this.isTransitioning) || (this.isTransitioning && this.runHomeDuringTransition)
    const isSubPage = (this.currentPage !== 'home' && !this.isTransitioning) || (this.isTransitioning && this.runSubPageDuringTransition)

    // 2. 涓婚〉甯冨眬
    if (isHome) {
      if (this.domRefs.dynamicLayoutContainer) {
        this.layoutManager.update(this.domRefs.dynamicLayoutContainer, this.domRefs.navContainer, this.effectManager)
      }
    }

    // ASCII rendering: home uses half-screen, subpages use full-screen pass.
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
    } else if (isSubPage) {
      if (this.domRefs.asciiContainer) {
        const pageName = this.currentPage as Exclude<PageName, 'home'>
        const asciiConf = ASCII_CONFIG.subPage[pageName]
        this.effectManager.renderSubPageAsciiPass(
          this.renderer,
          this.scene,
          camera,
          this.world.groundMirror,
          this.domRefs.asciiContainer,
          {
            domObstacles: this.layoutManager.getSubPageRects(),
            overlayOffsetX: responsive(asciiConf.overlayOffsetX),
            overlayOffsetY: responsive(asciiConf.overlayOffsetY),
            zoom: asciiConf.zoom,
            verticalShiftFactor: asciiConf.verticalShiftFactor,
            modelSearchRadius: asciiConf.modelSearchRadius,
            domPaddingX: asciiConf.domPaddingX,
            domPaddingY: asciiConf.domPaddingY,
          },
          this.world.model
        )
      }
    }

    // 4. SubPage 甯冨眬閬块殰
    if (this.currentPage !== 'home' && !this.isTransitioning) {
      const p = this.currentPage as Exclude<PageName, 'home'>
      this.layoutManager.updateSubPage(p, this.domRefs.dynamicLayoutContainer, this.effectManager)
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
