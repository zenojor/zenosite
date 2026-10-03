import * as THREE from 'three'
import { watch } from 'vue'
import { CameraManager } from './CameraManager'
import { World } from './World'
import { AsciiRenderer } from './AsciiRenderer'
import { SceneLayout } from './SceneLayout'
import { TextAnimator } from './TextAnimator'
import { HomeIntro } from './HomeIntro'
import { ASCII_CONFIG } from '@/config/ascii'
import { getRenderPixelRatio } from '@/config/rendering'
import { isMobileViewport, responsive } from '@/config/breakpoints'
import type { PageName } from '@/router/pages'
import { activePage, setPage, isAppTransitioning } from '@/state/navigationState'
import { getThemeSurfaceColor, themeMode } from '@/state/themeState'
import { isTransitionCancelled } from './TransitionController'

export interface SceneRuntimeRefs {
  canvas: HTMLCanvasElement
  asciiContainer: HTMLDivElement
  dynamicLayoutContainer: HTMLDivElement
  navContainer: HTMLDivElement | null
  backButton: HTMLElement | null
}

export class SceneRuntime {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private clock: THREE.Clock

  private cameraManager: CameraManager
  private world: World
  private asciiRenderer: AsciiRenderer
  private sceneLayout: SceneLayout
  private readonly textAnimator = new TextAnimator()
  private transitionVersion = 0
  private disposed = false
  private viewportMobile = isMobileViewport()

  private animationId: number | null = null
  private resizeId: number | null = null
  private domRefs: SceneRuntimeRefs

  private currentPage: PageName = 'home'
  private runHomeDuringTransition = false
  private runSubPageDuringTransition = false

  private stopWatcher: (() => void) | null = null
  private stopThemeWatcher: (() => void) | null = null
  private pendingPage: PageName | null = null
  private hasPlayedInitialTextIntro = false
  private homeIntro: HomeIntro | null = null

  private get isMobileMode() {
    return isMobileViewport()
  }

  constructor(refs: SceneRuntimeRefs) {
    this.domRefs = refs

    this.scene = new THREE.Scene()
    this.renderer = new THREE.WebGLRenderer({ canvas: refs.canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(getThemeSurfaceColor(), 0)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(getRenderPixelRatio())

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

      if (newPage === oldPage) {
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

    this.stopThemeWatcher = watch(themeMode, (mode) => {
      this.renderer.setClearColor(getThemeSurfaceColor(mode), 0)
      this.world.setTheme(mode)
    }, { immediate: true })

    // Initialize UI visibility from current page state.
    if (activePage.value !== 'home') {
      this.currentPage = activePage.value
      // If the route starts on a subpage, hide home nav and show Back.
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'none'
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'block'
      void this.cameraManager.transitionTo(activePage.value, 0).catch(this.handleTransitionError)
    } else {
      if (this.domRefs.backButton) this.domRefs.backButton.style.display = 'none'
      if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'flex'
    }

    this.syncViewportMode()
    this.playInitialTextIntro()
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    if (!document.hidden) this.animate()
  }

  private playInitialTextIntro() {
    if (this.hasPlayedInitialTextIntro) return
    this.hasPlayedInitialTextIntro = true

    if (this.currentPage === 'home') {
      void this.playInitialHomeIntro()
      return
    }

    void this.playInitialSubPageIntro(this.currentPage as Exclude<PageName, 'home'>)
  }

  private async playInitialHomeIntro() {
    const version = ++this.transitionVersion
    isAppTransitioning.value = true
    this.runHomeDuringTransition = true

    const mobileContact = this.domRefs.canvas.parentElement?.querySelector<HTMLElement>('.wechat-badge')
    const controls = this.isMobileMode ? (mobileContact ? [mobileContact] : []) : this.getNavElements()
    const intro = new HomeIntro(
      this.cameraManager, this.asciiRenderer, this.sceneLayout,
      this.domRefs.canvas, this.domRefs.asciiContainer, controls, this.isMobileMode,
    )
    this.homeIntro = intro
    intro.prepare()

    try {
      await this.world.ready
      if (!this.isCurrentTransition(version)) return
      await intro.play(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      if (!this.isCurrentTransition(version)) return
    } catch (error) {
      this.handleTransitionError(error)
    } finally {
      if (this.isCurrentTransition(version)) {
        intro.cancel()
        this.homeIntro = null
        this.runHomeDuringTransition = false
        this.finishIntroTransition()
      }
    }
  }

  private async playInitialSubPageIntro(page: Exclude<PageName, 'home'>) {
    const version = ++this.transitionVersion
    isAppTransitioning.value = true
    this.runSubPageDuringTransition = true

    this.asciiRenderer.setAsciiVisibility(0)
    this.sceneLayout.updateSubPage(page, this.domRefs.dynamicLayoutContainer, this.asciiRenderer)

    const elements = this.sceneLayout.getSubPageElements()
    const texts = this.sceneLayout.getSubPageTexts()
    const badgeContainer = this.sceneLayout.getBadgeContainer()
    const socialBadgeContainer = this.sceneLayout.getSocialBadgeContainer()
    if (badgeContainer) badgeContainer.style.opacity = '0'
    if (socialBadgeContainer) socialBadgeContainer.style.opacity = '0'
    this.prepareTextMaterialize(elements, texts)
    if (this.domRefs.backButton) {
      this.prepareTextMaterialize([this.domRefs.backButton], ['[ Back ]'])
    }

    try {
      await this.world.ready
      if (!this.isCurrentTransition(version)) return
      await Promise.all([
        this.textAnimator.materialize(elements, texts, 1.0),
        this.asciiRenderer.animateAsciiMaterialize(1.0),
        this.domRefs.backButton
          ? this.textAnimator.materialize([this.domRefs.backButton], ['[ Back ]'], 0.8)
          : Promise.resolve(),
      ])
      if (!this.isCurrentTransition(version)) return
      if (badgeContainer) void this.textAnimator.fade(badgeContainer, 1).catch(this.handleTransitionError)
      if (socialBadgeContainer) void this.textAnimator.fade(socialBadgeContainer, 1).catch(this.handleTransitionError)
    } catch (error) {
      this.handleTransitionError(error)
    } finally {
      if (this.isCurrentTransition(version)) {
        this.runSubPageDuringTransition = false
        this.finishIntroTransition()
      }
    }
  }

  private isCurrentTransition(version: number) {
    return !this.disposed && version === this.transitionVersion
  }

  private prepareTextMaterialize(elements: HTMLElement[], texts: string[]) {
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]!
      el.style.display = ''
      el.textContent = ' '.repeat(texts[i]?.length || 0)
    }
  }

  private finishIntroTransition() {
    isAppTransitioning.value = false

    const nextPage = this.pendingPage ?? activePage.value
    this.pendingPage = null

    if (!this.isMobileMode && nextPage !== this.currentPage) {
      void this.handlePageTransition(this.currentPage, nextPage)
    }
  }

  private getNavElements(): HTMLElement[] {
    return Array.from(this.domRefs.navContainer?.querySelectorAll('[data-page-nav]') || []) as HTMLElement[]
  }

  private getNavTexts(): string[] {
    return ['About', 'Experience', 'Projects', 'Contact']
  }

  private syncViewportMode() {
    // A completed dissolve hides individual buttons, not just their container.
    const navElements = this.getNavElements()
    const navTexts = this.getNavTexts()
    navElements.forEach((element, index) => {
      element.style.display = ''
      element.textContent = navTexts[index]!
    })
    if (this.domRefs.backButton) this.domRefs.backButton.textContent = '[ Back ]'

    this.domRefs.dynamicLayoutContainer.style.display = this.isMobileMode ? 'none' : 'block'
    if (this.domRefs.navContainer) {
      this.domRefs.navContainer.style.display = !this.isMobileMode && this.currentPage === 'home' ? 'flex' : 'none'
    }
    if (this.domRefs.backButton) {
      this.domRefs.backButton.style.display = !this.isMobileMode && this.currentPage !== 'home' ? 'block' : 'none'
    }
  }

  private settleViewport(page: PageName) {
    // Invalidate continuations before rejecting any pending animation promises.
    this.transitionVersion++
    this.homeIntro?.cancel()
    this.homeIntro = null
    this.textAnimator.cancel()
    this.sceneLayout.setHomeVisibility(1)
    this.asciiRenderer.setAsciiVisibility(1)
    this.sceneLayout.clearAll()
    this.asciiRenderer.clearAsciiPool()
    this.runHomeDuringTransition = false
    this.runSubPageDuringTransition = false
    this.pendingPage = null
    this.currentPage = page
    isAppTransitioning.value = false
    void this.cameraManager.transitionTo(page, 0).catch(this.handleTransitionError)
    this.syncViewportMode()
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

    const version = ++this.transitionVersion
    isAppTransitioning.value = true

    const navSpans = this.getNavElements()
    const navTexts = this.getNavTexts()
    const backBtn = this.domRefs.backButton

    try {
      if (from === 'home') {
        this.runHomeDuringTransition = true
        await Promise.all([
          this.sceneLayout.animateHomeDissolve(1.0),
          this.asciiRenderer.animateAsciiDissolve(1.0),
          this.textAnimator.dissolve(navSpans, 0.8),
        ])
        if (!this.isCurrentTransition(version)) return
        if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'none'
        this.runHomeDuringTransition = false
        this.sceneLayout.clearHome()
        this.asciiRenderer.clearAsciiPool()

        await this.cameraManager.transitionTo(to, 1.2)
        if (!this.isCurrentTransition(version)) return
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
            this.textAnimator.materialize(elements, texts, 1.0),
            this.asciiRenderer.animateAsciiMaterialize(1.0),
            backBtn ? this.textAnimator.materialize([backBtn], ['[ Back ]'], 0.8) : Promise.resolve(),
          ])
          if (!this.isCurrentTransition(version)) return
          if (badgeContainer) void this.textAnimator.fade(badgeContainer, 1).catch(this.handleTransitionError)
          if (socialBadgeContainer) void this.textAnimator.fade(socialBadgeContainer, 1).catch(this.handleTransitionError)
          this.runSubPageDuringTransition = false
        }
      } else if (to === 'home') {
        // 1. Dissolve the current subpage.
        this.runSubPageDuringTransition = true
        const elements = this.sceneLayout.getSubPageElements()
        const badgeContainer = this.sceneLayout.getBadgeContainer()
        const socialBadgeContainer = this.sceneLayout.getSocialBadgeContainer()
        await Promise.all([
          this.textAnimator.dissolve(elements, 1.0),
          this.asciiRenderer.animateAsciiDissolve(1.0),
          backBtn ? this.textAnimator.dissolve([backBtn], 0.8) : Promise.resolve(),
          badgeContainer ? this.textAnimator.fade(badgeContainer, 0, 0.8, 'power3.in') : Promise.resolve(),
          socialBadgeContainer ? this.textAnimator.fade(socialBadgeContainer, 0, 0.8, 'power3.in') : Promise.resolve(),
        ])
        if (!this.isCurrentTransition(version)) return
        this.runSubPageDuringTransition = false
        this.sceneLayout.clearSubPage()
        this.asciiRenderer.clearAsciiPool()

        // 2. Move the camera back to home.
        await this.cameraManager.transitionTo('home', 1.2)
        if (!this.isCurrentTransition(version)) return
        this.currentPage = 'home'

        // 3. Materialize home text, ASCII, and navigation.
        if (this.domRefs.navContainer) this.domRefs.navContainer.style.display = 'flex'
        this.runHomeDuringTransition = true
        await Promise.all([
          this.sceneLayout.animateHomeMaterialize(1.0),
          this.asciiRenderer.animateAsciiMaterialize(1.0),
          this.textAnimator.materialize(navSpans, navTexts, 0.8),
        ])
        if (!this.isCurrentTransition(version)) return
        this.runHomeDuringTransition = false
      } else {
        // Transition between subpages.
        this.runSubPageDuringTransition = true
        const elementsOld = this.sceneLayout.getSubPageElements()
        const badgeContainerOld = this.sceneLayout.getBadgeContainer()
        const socialBadgeContainerOld = this.sceneLayout.getSocialBadgeContainer()
        await Promise.all([
          this.textAnimator.dissolve(elementsOld, 1.0),
          this.asciiRenderer.animateAsciiDissolve(1.0),
          badgeContainerOld ? this.textAnimator.fade(badgeContainerOld, 0, 0.8, 'power3.in') : Promise.resolve(),
          socialBadgeContainerOld ? this.textAnimator.fade(socialBadgeContainerOld, 0, 0.8, 'power3.in') : Promise.resolve(),
        ])
        if (!this.isCurrentTransition(version)) return
        this.runSubPageDuringTransition = false
        this.sceneLayout.clearSubPage()
        this.asciiRenderer.clearAsciiPool()

        await this.cameraManager.transitionTo(to, 1.2)
        if (!this.isCurrentTransition(version)) return
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
          this.textAnimator.materialize(elementsNew, textsNew, 1.0),
          this.asciiRenderer.animateAsciiMaterialize(1.0),
        ])
        if (!this.isCurrentTransition(version)) return
        if (badgeContainerNew) void this.textAnimator.fade(badgeContainerNew, 1).catch(this.handleTransitionError)
        if (socialBadgeContainerNew) void this.textAnimator.fade(socialBadgeContainerNew, 1).catch(this.handleTransitionError)
        this.runSubPageDuringTransition = false
      }
    } catch (error) {
      this.handleTransitionError(error)
    } finally {
      if (this.isCurrentTransition(version)) {
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
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate)
    const delta = Math.min(this.clock.getDelta(), 0.1)

    this.world.update(delta)
    this.cameraManager.update()
    const camera = this.cameraManager.camera

    this.updateOverlay(camera)
    this.renderer.render(this.scene, camera)
  }

  private updateOverlay(camera: THREE.PerspectiveCamera) {
    const isHome = (this.currentPage === 'home' && !isAppTransitioning.value) || (isAppTransitioning.value && this.runHomeDuringTransition)
    const isSubPage = (this.currentPage !== 'home' && !isAppTransitioning.value) || (isAppTransitioning.value && this.runSubPageDuringTransition)
    // During the camera-only part of a transition both text layers are absent.
    if (!this.isMobileMode && !isHome && !isSubPage) return

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

      return
    }

    // 2. Home layout.
    if (isHome) {
      if (this.domRefs.dynamicLayoutContainer) {
        this.sceneLayout.update(this.domRefs.dynamicLayoutContainer, this.domRefs.navContainer, this.asciiRenderer)
      }
    }

    // Update subpage positions before measuring obstacles for this frame.
    if (this.currentPage !== 'home' && !isAppTransitioning.value) {
      const p = this.currentPage as Exclude<PageName, 'home'>
      this.sceneLayout.updateSubPage(p, this.domRefs.dynamicLayoutContainer, this.asciiRenderer)
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
  }

  private onVisibilityChange = () => {
    this.homeIntro?.setPaused(document.hidden)
    if (document.hidden) {
      if (this.animationId !== null) cancelAnimationFrame(this.animationId)
      this.animationId = null
      this.clock.stop()
    } else if (this.animationId === null) {
      this.clock.start()
      this.animate()
    }
  }

  private onResize = () => {
    const mobile = this.isMobileMode
    if (mobile !== this.viewportMobile) {
      this.viewportMobile = mobile
      this.settleViewport('home')
      setPage('home', true)
    } else if (isAppTransitioning.value) {
      this.settleViewport(mobile ? 'home' : activePage.value)
    } else {
      this.syncViewportMode()
    }
    if (this.resizeId !== null) return
    this.resizeId = requestAnimationFrame(this.resizeViewport)
  }

  private resizeViewport = () => {
    this.resizeId = null
    this.cameraManager.onResize()
    this.renderer.setPixelRatio(getRenderPixelRatio())
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.world.onResize()
    this.asciiRenderer.onResize()
  }

  dispose() {
    this.disposed = true
    this.transitionVersion++
    this.homeIntro?.cancel()
    this.homeIntro = null
    this.textAnimator.cancel()
    isAppTransitioning.value = false
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    if (this.resizeId !== null) cancelAnimationFrame(this.resizeId)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    if (this.stopWatcher) this.stopWatcher()
    if (this.stopThemeWatcher) this.stopThemeWatcher()
    window.removeEventListener('resize', this.onResize)
    this.cameraManager.dispose()
    this.sceneLayout.clearAll()
    this.world.dispose()
    this.asciiRenderer.dispose()
    this.renderer.dispose()
  }

  private handleTransitionError = (error: unknown) => {
    if (isTransitionCancelled(error)) return
    console.error('Page transition failed', error)
  }
}
