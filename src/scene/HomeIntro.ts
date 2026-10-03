import gsap from 'gsap'
import { TransitionController } from './TransitionController'
import type { CameraManager } from './CameraManager'
import type { AsciiRenderer } from './AsciiRenderer'
import type { SceneLayout } from './SceneLayout'
import { setText } from './dom/updates'

/** Shared with the render loop so the moving silhouette keeps driving layout. */
export interface HomeIntroState {
  contour: number
  fill: number
  camera: number
  title: number
  body: number
}

interface IntroControlState {
  element: HTMLElement
  progress: number
  pointerEvents: string
  labels: { element: HTMLElement; text: string; whiteSpace: string }[]
  images: { element: HTMLImageElement; opacity: string }[]
}

export class HomeIntro {
  private readonly state: HomeIntroState = { contour: 0, fill: 0, camera: 0, title: 0, body: 0 }
  private readonly transition = new TransitionController()
  private timeline: gsap.core.Timeline | null = null
  private active = false
  private controlStates: IntroControlState[] = []

  constructor(
    private readonly camera: CameraManager,
    private readonly ascii: AsciiRenderer,
    private readonly layout: SceneLayout,
    private readonly canvas: HTMLCanvasElement,
    private readonly asciiContainer: HTMLDivElement,
    private readonly controls: HTMLElement[],
    private readonly mobile: boolean,
  ) {}

  prepare() {
    this.active = true
    this.camera.prepareHomeIntro(this.mobile)
    this.layout.setHomeVisibility(1)
    this.ascii.setAsciiVisibility(1)
    this.layout.setHomeIntro(this.state)
    this.ascii.setHomeIntro(this.state)
    this.canvas.style.opacity = '0'
    this.canvas.style.willChange = 'opacity'
    this.asciiContainer.style.opacity = '0.5'
    // Keep the original left-to-right arrival, updating whole glyphs in place.
    this.controlStates = this.controls.map(element => {
      const textElements = element.childElementCount
        ? Array.from(element.querySelectorAll<HTMLElement>('span'))
        : [element]
      const control: IntroControlState = {
        element,
        progress: 0,
        pointerEvents: element.style.pointerEvents,
        labels: textElements.map(label => ({ element: label, text: label.textContent || '', whiteSpace: label.style.whiteSpace })),
        images: Array.from(element.querySelectorAll('img')).map(image => ({ element: image, opacity: image.style.opacity })),
      }
      element.style.pointerEvents = 'none'
      for (const label of control.labels) label.element.style.whiteSpace = 'pre'
      for (const image of control.images) image.element.style.opacity = '0'
      this.updateControl(control)
      return control
    })
  }

  private updateControl(control: IntroControlState) {
    for (const label of control.labels) {
      const count = Math.floor(label.text.length * control.progress)
      setText(label.element, label.text.slice(0, count) + ' '.repeat(label.text.length - count))
    }
  }

  play(reducedMotion: boolean): Promise<void> {
    if (reducedMotion) {
      this.finish()
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const timeline = gsap.timeline({
        paused: true,
        defaults: { ease: 'power2.out' },
        onComplete: () => {
          this.finish()
          this.transition.complete()
        },
      })
      this.timeline = timeline

      timeline
        .addLabel('outline', 0)
        .addLabel('arrival', 0.18)
        .addLabel('typeset', 0.48)
        .addLabel('navigation', 1.13)
        .to(this.state, { contour: 1, duration: 0.46, ease: 'power1.out' }, 'outline')
        .to(this.canvas, { opacity: 1, duration: 0.42 }, 'arrival')
        .to(this.state, {
          camera: 1,
          duration: 1.1,
          ease: 'power3.out',
          onUpdate: () => this.camera.setHomeIntroProgress(this.state.camera),
        }, 'arrival')
        .to(this.state, { fill: 1, duration: 0.68, ease: 'power1.out' }, 'arrival+=0.14')
        .to(this.asciiContainer, { opacity: 1, duration: 0.68 }, 'arrival+=0.14')
        .to(this.state, { title: 1, duration: 0.42, ease: 'power1.out' }, 'typeset')
        .to(this.state, { body: 1, duration: 0.74, ease: 'power1.out' }, 'typeset+=0.2')

      this.controlStates.forEach((control, i) => {
        const position = `navigation+=${i * 0.055}`
        timeline.to(control, {
          progress: 1,
          duration: 0.34,
          onUpdate: () => this.updateControl(control),
        }, position)
        if (control.images.length) {
          timeline.to(control.images.map(image => image.element), { opacity: 1, duration: 0.34 }, position)
        }
      })

      if (this.mobile) timeline.timeScale(1.45)
      this.transition.track([timeline], resolve, reject)
      if (!document.hidden) timeline.play()
    })
  }

  setPaused(paused: boolean) {
    if (paused) this.timeline?.pause()
    else this.timeline?.play()
  }

  cancel() {
    this.transition.cancel()
    this.finish()
  }

  private finish() {
    if (!this.active) return
    this.active = false
    this.timeline = null
    this.camera.finishHomeIntro()
    this.layout.setHomeIntro(null)
    this.ascii.setHomeIntro(null)
    this.canvas.style.removeProperty('opacity')
    this.canvas.style.removeProperty('will-change')
    this.asciiContainer.style.removeProperty('opacity')
    for (const control of this.controlStates) {
      control.element.style.pointerEvents = control.pointerEvents
      for (const label of control.labels) {
        setText(label.element, label.text)
        label.element.style.whiteSpace = label.whiteSpace
      }
      for (const image of control.images) image.element.style.opacity = image.opacity
    }
    this.controlStates = []
  }
}
