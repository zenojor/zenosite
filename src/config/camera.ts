import type { PageName } from '@/router/pages'

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
