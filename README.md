# Personal Site

An interactive personal portfolio built with Vue 3, TypeScript, Three.js, GSAP, and a custom ASCII rendering layer.

The site presents a full-screen 3D scene with responsive navigation, animated page transitions, ASCII-style text layouts, social badges, and mobile-specific contact affordances.

## Tech Stack

- Vue 3
- Vue Router
- TypeScript
- Vite
- Three.js
- GSAP
- @chenglou/pretext

## Project Structure

```text
src/
  assets/          Static styles and 3D model assets
  config/          Camera, layout, breakpoint, and ASCII settings
  content/         Portfolio copy and badge content
  router/          Route definitions and page helpers
  scene/           Three.js scene, ASCII renderer, layout, and animation runtime
  state/           Shared navigation state
  views/           Vue page-level view components
```

## Getting Started

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

## Deployment

This project is a static Vite app. The production output is generated in `dist/`.

The `public/_redirects` file is included for SPA fallback routing on Netlify-style static hosts.

## Notes

- The 3D model is stored at `src/assets/models/cloud-from-world-of-final-fantasy.glb`.
- Personal profile copy, project descriptions, and social badge links live in `src/content/siteContent.ts`.
- The package is marked `private` to prevent accidental npm publishing; that does not affect making the GitHub repository public.
