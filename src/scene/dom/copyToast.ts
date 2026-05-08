export class CopyToast {
  private el: HTMLDivElement | null = null

  show(text: string) {
    if (!this.el) {
      this.el = document.createElement('div')
      this.el.style.position = 'fixed'
      this.el.style.top = '40px'
      this.el.style.left = '50%'
      this.el.style.transform = 'translateX(-50%)'
      this.el.style.backgroundColor = 'var(--surface-color)'
      this.el.style.color = 'var(--text-color)'
      this.el.style.border = '1px solid var(--border-color)'
      this.el.style.padding = '10px 20px'
      this.el.style.fontFamily = "'Courier New', Courier, monospace"
      this.el.style.fontSize = '14px'
      this.el.style.fontWeight = 'bold'
      this.el.style.zIndex = '1000'
      this.el.style.pointerEvents = 'none'
      this.el.style.opacity = '0'
      this.el.style.transition = 'opacity 0.3s ease, margin-top 0.3s ease'
      this.el.style.boxShadow = '0 4px 12px var(--toast-shadow-color)'
      document.body.appendChild(this.el)
    }

    this.el.textContent = `> Copied: ${text}`
    this.el.style.marginTop = '0'
    this.el.style.opacity = '1'
    this.el.style.marginTop = '10px'

    window.setTimeout(() => {
      if (this.el) {
        this.el.style.opacity = '0'
        this.el.style.marginTop = '0'
      }
    }, 2000)
  }

  dispose() {
    this.el?.remove()
    this.el = null
  }
}
