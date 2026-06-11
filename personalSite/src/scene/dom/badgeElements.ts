import type { SocialBadge } from '@/content/siteContent'

export function createBadgeImage(src: string, lineHeight: number): HTMLImageElement {
  const img = document.createElement('img')
  img.src = src
  img.style.height = getBadgeHeight(lineHeight)
  img.style.display = 'block'
  img.loading = 'lazy'
  img.decoding = 'async'
  img.referrerPolicy = 'no-referrer'
  img.draggable = false
  return img
}

export function setBadgeImageHeights(container: HTMLElement, lineHeight: number) {
  const imgs = container.querySelectorAll('img')
  imgs.forEach((img) => {
    ;(img as HTMLImageElement).style.height = getBadgeHeight(lineHeight)
  })
}

export function createSocialBadgeLink(
  badge: SocialBadge,
  lineHeight: number,
  onCopy: (text: string) => void,
): HTMLAnchorElement {
  const wrapper = document.createElement('a')
  wrapper.style.cursor = 'pointer'
  wrapper.style.display = 'inline-block'
  wrapper.style.transition = 'opacity 0.2s ease, transform 0.15s ease'
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.opacity = '0.75'
    wrapper.style.transform = 'scale(1.05)'
  })
  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.opacity = '1'
    wrapper.style.transform = 'scale(1)'
  })

  if (badge.action.type === 'link') {
    wrapper.href = badge.action.url
    wrapper.target = '_blank'
    wrapper.rel = 'noopener noreferrer'
  } else {
    const copyText = badge.action.text
    wrapper.addEventListener('click', (e) => {
      e.preventDefault()
      navigator.clipboard.writeText(copyText)
        .then(() => {
          onCopy(copyText)
        })
        .catch(() => {})
    })
  }

  wrapper.appendChild(createBadgeImage(badge.img, lineHeight))
  return wrapper
}

function getBadgeHeight(lineHeight: number) {
  return `${Math.max(12, lineHeight * 1.3)}px`
}
