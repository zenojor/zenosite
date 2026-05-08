import type { PageName } from '@/router/pages'

export const ASCII_CONFIG = {
  charWidth: 11.8,
  charHeight: 18,
  mobile: {
    zoom: 1.82,
    overlayOffsetX: 0,
    overlayOffsetY: 0,
    verticalShiftFactor: 0.14,
    trackModelCenter: false,
    modelSearchRadius: 2,
    domPaddingX: 0,
    domPaddingY: 0,
  },
  home: {
    zoom: 4.0,
    modelDodgePadding: 16,
    domPaddingX: 10,
    domPaddingY: 2,
  },
  subPage: {
    about: {
      zoom: 2.0,
      overlayOffsetX: { desktop: 0, mobile: 0 },
      overlayOffsetY: { desktop: 0, mobile: 0 },
      verticalShiftFactor: 0.15,
      modelSearchRadius: 2,
      domPaddingX: 12,
      domPaddingY: 2,
    },
    experience: {
      zoom: 2.0,
      overlayOffsetX: { desktop: 200, mobile: 28 },
      overlayOffsetY: { desktop: 40, mobile: 8 },
      verticalShiftFactor: 0.15,
      modelSearchRadius: 2,
      domPaddingX: 12,
      domPaddingY: 2,
    },
    projects: {
      zoom: 2.0,
      overlayOffsetX: { desktop: -300, mobile: 0 },
      overlayOffsetY: { desktop: 30, mobile: 0 },
      verticalShiftFactor: 0.15,
      modelSearchRadius: 2,
      domPaddingX: 12,
      domPaddingY: 2,
    },
    contact: {
      zoom: 2.0,
      overlayOffsetX: { desktop: 350, mobile: 0 },
      overlayOffsetY: { desktop: 30, mobile: 0 },
      verticalShiftFactor: 0.15,
      modelSearchRadius: 2,
      domPaddingX: 12,
      domPaddingY: 2,
    },
  } as Record<
    Exclude<PageName, 'home'>,
    {
      zoom: number
      overlayOffsetX: { desktop: number; mobile: number }
      overlayOffsetY: { desktop: number; mobile: number }
      verticalShiftFactor: number
      modelSearchRadius: number
      domPaddingX: number
      domPaddingY: number
    }
  >,
}
