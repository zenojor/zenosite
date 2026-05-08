import * as THREE from 'three'
import { watch } from 'vue'
import gsap from 'gsap'
import { CameraManager } from './CameraManager'
import { World } from './World'
import { AsciiRenderer } from './AsciiRenderer'
import { SceneLayout } from './SceneLayout'
import { TextAnimator } from './TextAnimator'
import { ASCII_CONFIG } from '@/config/ascii'
import { isMobileViewport, responsive } from '@/config/breakpoints'
import type { PageName } from '@/router/pages'
import { activePage, setPage, isAppTransitioning } from '@/state/navigationState'

export interface SceneRuntimeRefs {
  canvas: HTMLCanvasElement
  asciiContainer: HTMLDivElement
  dynamicLayoutContainer: HTMLDivElement
  navContainer: HTMLDivElement | null
  backButton: HTMLDivElement | null
}

export class SceneRuntime {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private clock: THREE.Clock

  private cameraManager: CameraManager
  private world: World
  private asciiRenderer: AsciiRenderer
  private sceneLayout: SceneLayout

  private animationId: number | null = null
  private domRefs: SceneRuntimeRefs

  private currentPage: PageName = 'home'
  private runHomeDuringTransition = false
  private runSubPageDuringTransition = false

  private stopWatcher: (() => void) | null = null
  private pendingPage: PageName | null = null

  private get isMobileMode() {
    return isMobileViewport()
  }

  constructor(refs: SceneRuntimeRefs) {
    this.domRefs = refs

    this.scene = new THREE.Scene()
    this.renderer = new THREE.WebGLRenderer({ canvas: refs.canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0xffffff, 0)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)

    this.clock = new THREE.Clock()

    this.cameraManager = new CameraManager(refs.canvas)
    this.world = new World(this.scene)
    this.asciiRenderer = new AsciiRenderer()
    this.sceneLayout = new SceneLayout()

    if (this.isMobileMode && activePage.value !== 'home') {
      setPage('home', true)
    }

    this.stopWatcher = watch(activePage, (newPage, oldPage) => {
      if (this.isMobileMode) {
        if (newPage !== 'home') setPage('home')
        this.currentPage = 'home'
        return
      }

      if (newPage === oldPage || newPage === this.currentPage) {
        return
      }

      if (isAppTransitioning.value) {
        this.pendingPage = newPage
        return
      }

      if (newPage !== this.currentPage) {
        void this.handlePageTransition(this.currentPage, newPage)
      }
    })

    // Initialize UI visibility from current page state.
    if (activePage.value !== 'home') {
      this.currentPage = activePage.value
      // If the route starts on a subpage, hide home nav and show Back.
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'none'
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'block'
      void this.cameraManager.transitionTo(activePage.value, 0)
    } else {
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'none'
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'flex'
    }

    this.syncViewportMode()
    window.addEventListener('resize', this.onResize)
    this.animate()
  }

  private syncViewportMode() {
    if (this.isMobileMode) {
      this.currentPage = 'home'
      if (this.cameraManager.getMode() !== 'orbit') {
        void this.cameraManager.transitionTo('home', 0.6)
      }
      this.sceneLayout.clearAll()
      this.asciiRenderer.clearAsciiPool()
      this.domRefs.dynamicLayoutContainer.style.display = 'none'
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'none'
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'none'
      return
    }

    this.domRefs.dynamicLayoutContainer.style.display = 'block'

    if (activePage.value !== 'home') {
      this.currentPage = activePage.value
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'none'
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'block'
    } else {
      this.currentPage = 'home'
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'none'
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'flex'
    }
  }

  private async handlePageTransition(from: PageName, to: PageName) {
    if (this.isMobileMode) {
      this.currentPage = 'home'
      return
    }

    if (from === to) return

    if (isAppTransitioning.value) {
      this.pendingPage = to
      return
    }

    isAppTransitioning.value = true

    const navSpans = Array.from(this.domRefs.navContainer?.querySelectorAll('span') || []) as unknown as HTMLDivElement[]
    const navTexts = ['About', 'Experience', 'Projects', 'Contact']
    const backBtn = this.domRefs.backButton

    try {
      if (from === 'home') {
        this.runHomeDuringTransition = true
        await Promise.all([
          this.sceneLayout.animateHomeDissolve(1.0),
          this.asciiRenderer.animateAsciiDissolve(1.0),
          TextAnimator.dissolve(navSpans, 0.8),
        ])
        if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'none'
        this.runHomeDuringTransition = false
        this.asciiRenderer.clearAsciiPool()

        await this.cameraManager.transitionTo(to, 1.2)
        this.currentPage = to

        if (to !== 'home') {
          this.runSubPageDuringTransition = true
          this.sceneLayout.updateSubPage(to, this.domRefs.dynamicLayoutContainer, this.asciiRenderer)

          const elements = this.sceneLayout.getSubPageElements()
          const texts = this.sceneLayout.getSubPageTexts()
          const badgeContainer = this.sceneLayout.getBadgeContainer()
          const socialBadgeContainer = this.sceneLayout.getSocialBadgeContainer()
          if (badgeContainer) badgeContainer.style.opacity = '0'
          if (socialBadgeContainer) socialBadgeContainer.style.opacity = '0'

          await Promise.all([
            TextAnimator.materialize(elements, texts, 1.0),
            this.asciiRenderer.animateAsciiMaterialize(1.0),
            backBtn ? TextAnimator.materialize([backBtn], ['[ Back ]'], 0.8) : Promise.resolve(),
          ])
          if (badgeContainer) gsap.to(badgeContainer, { opacity: 1, duration: 0.8, ease: 'power3.out' })
          if (socialBadgeContainer) gsap.to(socialBadgeContainer, { opacity: 1, duration: 0.8, ease: 'power3.out' })
          this.runSubPageDuringTransition = false
        }
      } else if (to === 'home') {
        // 1. Dissolve the current subpage.
        this.runSubPageDuringTransition = true
        const elements = this.sceneLayout.getSubPageElements()
        const badgeContainer = this.sceneLayout.getBadgeContainer()
        const socialBadgeContainer = this.sceneLayout.getSocialBadgeContainer()
        await Promise.all([
          TextAnimator.dissolve(elements, 1.0),
          this.asciiRenderer.animateAsciiDissolve(1.0),
          backBtn ? TextAnimator.dissolve([backBtn], 0.8) : Promise.resolve(),
          badgeContainer ? gsap.to(badgeContainer, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
          socialBadgeContainer ? gsap.to(socialBadgeContainer, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
        ])
        this.runSubPageDuringTransition = false
        this.sceneLayout.clearSubPage()
        this.asciiRenderer.clearAsciiPool()

        // 2. Move the camera back to home.
        await this.cameraManager.transitionTo('home', 1.2)
        this.currentPage = 'home'

        // 3. Materialize home text, ASCII, and navigation.
        if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'flex'
        this.runHomeDuringTransition = true
        await Promise.all([
          this.sceneLayout.animateHomeMaterialize(1.0),
          this.asciiRenderer.animateAsciiMaterialize(1.0),
          TextAnimator.materialize(navSpans, navTexts, 0.8),
        ])
        this.runHomeDuringTransition = false
      } else {
        // Transition between subpages.
        this.runSubPageDuringTransition = true
        const elementsOld = this.sceneLayout.getSubPageElements()
        const badgeContainerOld = this.sceneLayout.getBadgeContainer()
        const socialBadgeContainerOld = this.sceneLayout.getSocialBadgeContainer()
        await Promise.all([
          TextAnimator.dissolve(elementsOld, 1.0),
          this.asciiRenderer.animateAsciiDissolve(1.0),
          badgeContainerOld ? gsap.to(badgeContainerOld, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
          socialBadgeContainerOld ? gsap.to(socialBadgeContainerOld, { opacity: 0, duration: 0.8, ease: 'power3.in' }) : Promise.resolve(),
        ])
        this.runSubPageDuringTransition = false
        this.sceneLayout.clearSubPage()
        this.asciiRenderer.clearAsciiPool()

        await this.cameraManager.transitionTo(to, 1.2)
        this.currentPage = to

        this.runSubPageDuringTransition = true
        this.sceneLayout.updateSubPage(to, this.domRefs.dynamicLayoutContainer, this.asciiRenderer)

        const elementsNew = this.sceneLayout.getSubPageElements()
        const textsNew = this.sceneLayout.getSubPageTexts()
        const badgeContainerNew = this.sceneLayout.getBadgeContainer()
        const socialBadgeContainerNew = this.sceneLayout.getSocialBadgeContainer()
        if (badgeContainerNew) badgeContainerNew.style.opacity = '0'
        if (socialBadgeContainerNew) socialBadgeContainerNew.style.opacity = '0'

        await Promise.all([
          TextAnimator.materialize(elementsNew, textsNew, 1.0),
          this.asciiRenderer.animateAsciiMaterialize(1.0),
        ])
        if (badgeContainerNew) gsap.to(badgeContainerNew, { opacity: 1, duration: 0.8, ease: 'power3.out' })
        if (socialBadgeContainerNew) gsap.to(socialBadgeContainerNew, { opacity: 1, duration: 0.8, ease: 'power3.out' })
        this.runSubPageDuringTransition = false
      }
    } catch (error) {
      console.error('Page transition failed', error)
    } finally {
      this.runHomeDuringTransition = false
      this.runSubPageDuringTransition = false
      isAppTransitioning.value = false

      const nextPage = this.pendingPage ?? activePage.value
      this.pendingPage = null

      if (!this.isMobileMode && nextPage !== this.currentPage) {
        void this.handlePageTransition(this.currentPage, nextPage)
      }
    }
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()

    this.world.update(delta)
    this.cameraManager.update()
    const camera = this.cameraManager.camera

    // 1. Full-screen silhouette pass for model avoidance.
    this.asciiRenderer.renderSilhouettePass(this.renderer, this.scene, camera, this.world.groundMirror)

    if (this.isMobileMode) {
      this.asciiRenderer.renderSubPageAsciiPass(
        this.renderer,
        this.scene,
        camera,
        this.world.groundMirror,
        this.domRefs.asciiContainer,
        {
          domObstacles: [],
          overlayOffsetX: ASCII_CONFIG.mobile.overlayOffsetX,
          overlayOffsetY: ASCII_CONFIG.mobile.overlayOffsetY,
          zoom: ASCII_CONFIG.mobile.zoom,
          trackModelCenter: ASCII_CONFIG.mobile.trackModelCenter,
          verticalShiftFactor: ASCII_CONFIG.mobile.verticalShiftFactor,
          modelSearchRadius: ASCII_CONFIG.mobile.modelSearchRadius,
          domPaddingX: ASCII_CONFIG.mobile.domPaddingX,
          domPaddingY: ASCII_CONFIG.mobile.domPaddingY,
        },
        this.world.model
      )

      this.renderer.render(this.scene, camera)
      return
    }

    const isHome = (this.currentPage === 'home' && !isAppTransitioning.value) || (isAppTransitioning.value && this.runHomeDuringTransition)
    const isSubPage = (this.currentPage !== 'home' && !isAppTransitioning.value) || (isAppTransitioning.value && this.runSubPageDuringTransition)

    // 2. Home layout.
    if (isHome) {
      if (this.domRefs.dynamicLayoutContainer) {
        this.sceneLayout.update(this.domRefs.dynamicLayoutContainer, this.domRefs.navContainer, this.asciiRenderer)
      }
    }

    // ASCII rendering: home uses half-screen, subpages use full-screen pass.
    if (isHome) {
      if (this.domRefs.asciiContainer) {
        this.asciiRenderer.renderAsciiPass(
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
        this.asciiRenderer.renderSubPageAsciiPass(
          this.renderer,
          this.scene,
          camera,
          this.world.groundMirror,
          this.domRefs.asciiContainer,
          {
            domObstacles: this.sceneLayout.getSubPageRects(),
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

    // 4. Update subpage layout obstacles.
    if (this.currentPage !== 'home' && !isAppTransitioning.value) {
      const p = this.currentPage as Exclude<PageName, 'home'>
      this.sceneLayout.updateSubPage(p, this.domRefs.dynamicLayoutContainer, this.asciiRenderer)
    }

    this.renderer.render(this.scene, camera)
  }

  private onResize = () => {
    this.cameraManager.onResize()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.world.onResize()
    this.asciiRenderer.onResize()
    if (this.isMobileMode && activePage.value !== 'home') {
      setPage('home', true)
    }
    this.syncViewportMode()
  }

  dispose() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    if (this.stopWatcher) this.stopWatcher()
    window.removeEventListener('resize', this.onResize)
    this.cameraManager.dispose()
    this.asciiRenderer.dispose()
    this.renderer.dispose()
  }
}

