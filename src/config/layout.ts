import type { PageName } from '@/router/pages'

export const HOME_LAYOUT = {
  title: {
    startY: 40,
    rightSpace: { desktop: 40, mobile: 20 },
    color: '#595959',
    maxFontSize: 16,
    minFontSize: 6,
  },
  body: {
    copyRepeat: { desktop: 7, medium: 5, tablet: 3, mobile: 2 },
    xOffset: 20,
    yStart: 60,
    rightPadding: 40,
    bottomPadding: 100,
    lineHeight: 18,
    titleDodgePadding: 48,
    modelDodgePadding: 20,
  },
  nav: {
    mobilePadding: 20,
    desktopXOffset: 20,
  },
}

export const SUB_PAGE_LAYOUT: Record<
  Exclude<PageName, 'home'>,
  {
    rightMargin: { desktop: number; mobile: number }
    leftMargin: { desktop: number; mobile: number }
    verticalOffset: number
    textAlign: 'left' | 'right'
    maxFontSize: number
    minFontSize: number
  }
> = {
  about: {
    rightMargin: { desktop: 36, mobile: 16 },
    leftMargin: { desktop: 120, mobile: 40 },
    verticalOffset: 0,
    textAlign: 'right',
    maxFontSize: 16,
    minFontSize: 6,
  },
  experience: {
    rightMargin: { desktop: 36, mobile: 16 },
    leftMargin: { desktop: 120, mobile: 40 },
    verticalOffset: 0.145,
    textAlign: 'left',
    maxFontSize: 16,
    minFontSize: 6,
  },
  projects: {
    rightMargin: { desktop: 36, mobile: 16 },
    leftMargin: { desktop: 120, mobile: 40 },
    verticalOffset: 0,
    textAlign: 'right',
    maxFontSize: 16,
    minFontSize: 6,
  },
  contact: {
    rightMargin: { desktop: 36, mobile: 16 },
    leftMargin: { desktop: 120, mobile: 40 },
    verticalOffset: 0,
    textAlign: 'left',
    maxFontSize: 16,
    minFontSize: 6,
  },
}
