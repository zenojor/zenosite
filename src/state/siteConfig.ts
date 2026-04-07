import type { PageName } from './siteState'

/**
 * ===================================================================
 *  站点集中化可调参数配置
 *  调试时只需修改此文件即可调整相机、文本位置、ASCII 剪影等视觉效果。
 * ===================================================================
 */

// ───────────────────── 响应式断点 ─────────────────────
export const BREAKPOINTS = {
  mobile: 768,
  smallMobile: 638,
}

/** 根据当前窗口宽度选择桌面端或移动端的值 */
export function responsive<T>(values: { desktop: T; mobile: T }): T {
  return window.innerWidth < BREAKPOINTS.mobile ? values.mobile : values.desktop
}

// ───────────────────── 相机参数 ─────────────────────
export const CAMERA_CONFIG = {
  fov: 45,
  orbit: {
    distance: 18,
    height: 3,
    defaultVelocity: 0.002,
  },
  transitionDuration: 0.8,
  views: {
    about: {
      position: { x: 6, y: -1, z: -6 },
      lookAt: { x: -4, y: 0, z: 0 },
    },
    experience: {
      position: { x: 5, y: 0, z: 10 },
      lookAt: { x: -4, y: 0, z: 0 },
    },
    projects: {
      position: { x: 6, y: 6, z: -6 },
      lookAt: { x: -4, y: 0, z: 0 },
    },
    contact: {
      position: { x: 10, y: 0, z: 3 },
      lookAt: { x: 0, y: 0, z: 3 },
    },
  } as Record<
    Exclude<PageName, 'home'>,
    { position: { x: number; y: number; z: number }; lookAt: { x: number; y: number; z: number } }
  >,
}

// ───────────────────── 主页布局 ─────────────────────
export const HOME_LAYOUT = {
  title: {
    startY: 40,
    rightSpace: { desktop: 40, mobile: 20 },
    color: '#595959',
    maxFontSize: 16,
    minFontSize: 6,
  },
  body: {
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

// ───────────────────── 子页面文本布局（每页面独立） ─────────────────────
export const SUB_PAGE_LAYOUT: Record<
  Exclude<PageName, 'home'>,
  {
    rightMargin: { desktop: number; mobile: number }
    leftMargin: { desktop: number; mobile: number }
    /** 垂直偏移量，占窗口高度的比例（0 = 垂直居中, 0.15 = 向下偏移15%） */
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

// ───────────────────── ASCII 渲染参数 ─────────────────────
export const ASCII_CONFIG = {
  charWidth: 11.8,
  charHeight: 18,

  /** 主页 ASCII */
  home: {
    zoom: 4.0,
    modelDodgePadding: 16,
    domPaddingX: 10,
    domPaddingY: 2,
  },

  /** 子页面 ASCII（每页面独立配置） */
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
