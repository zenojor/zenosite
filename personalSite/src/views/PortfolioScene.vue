<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SceneRuntime } from '@/scene/SceneRuntime'
import { BREAKPOINTS } from '@/config/breakpoints'
import { getPageFromRoute, PAGE_PATHS, type PageName } from '@/router/pages'
import { activePage, isAppTransitioning, setPage } from '@/state/navigationState'
import { isNightMode, toggleThemeMode } from '@/state/themeState'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const asciiRef = ref<HTMLDivElement | null>(null)
const dynamicLayoutRef = ref<HTMLDivElement | null>(null)
const navRef = ref<HTMLDivElement | null>(null)
const backRef = ref<HTMLButtonElement | null>(null)
const viewportWidth = ref(window.innerWidth)
const wechatCopied = ref(false)
const route = useRoute()
const router = useRouter()

let sceneRuntime: SceneRuntime | null = null

const isMobile = computed(() => viewportWidth.value < BREAKPOINTS.mobile)
const routePage = computed(() => getPageFromRoute(route))

const updateViewport = () => {
  viewportWidth.value = window.innerWidth
  if (isMobile.value && routePage.value !== 'home') {
    void router.replace(PAGE_PATHS.home)
  }
}

const handleNav = (page: PageName) => {
  if (isAppTransitioning.value) return

  const targetPage = activePage.value === page && page !== 'home' ? 'home' : page
  void router.push(PAGE_PATHS[targetPage])
}

const handleWechatBadge = async () => {
  try {
    await navigator.clipboard.writeText('zenoknowda')
    wechatCopied.value = true
    window.setTimeout(() => {
      wechatCopied.value = false
    }, 1600)
  } catch {
    wechatCopied.value = false
  }
}

onMounted(() => {
  if (!canvasRef.value || !asciiRef.value || !dynamicLayoutRef.value) return

  window.addEventListener('resize', updateViewport)
  sceneRuntime = new SceneRuntime({
    canvas: canvasRef.value,
    asciiContainer: asciiRef.value,
    dynamicLayoutContainer: dynamicLayoutRef.value,
    navContainer: navRef.value,
    backButton: backRef.value,
  })
})

watch(
  routePage,
  (page) => {
    if (isMobile.value && page !== 'home') {
      void router.replace(PAGE_PATHS.home)
      return
    }

    setPage(page)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  sceneRuntime?.dispose()
  sceneRuntime = null
})
</script>

<template>
  <div class="scene-container">
    <!-- Back Button -->
    <button
      class="back-btn" 
      :class="{ 'is-disabled': isAppTransitioning }"
      ref="backRef"
      type="button"
      @click="handleNav('home')"
      :aria-disabled="isAppTransitioning"
      :disabled="isAppTransitioning"
      style="display: none;" 
    >
      [ Back ]
    </button>

    <div class="ascii-overlay" ref="asciiRef"></div>
    <div class="dynamic-layout" ref="dynamicLayoutRef"></div>

    <button
      class="theme-toggle"
      type="button"
      @click="toggleThemeMode"
      :aria-label="isNightMode ? 'Switch to light mode' : 'Switch to night mode'"
    >
      {{ isNightMode ? '☼' : '☾' }}
    </button>

    <button
      v-if="isMobile"
      class="wechat-badge"
      type="button"
      @click="handleWechatBadge"
      :aria-label="wechatCopied ? 'WeChat copied' : 'Copy WeChat ID'"
    >
      <img
        src="https://img.shields.io/badge/WeChat-07C160?logo=wechat&logoColor=white"
        alt="WeChat badge"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      />
      <span>{{ wechatCopied ? 'Copied: zenoknowda' : 'zenoknowda' }}</span>
    </button>

    <!-- Nav Container -->
    <div 
      class="nav-container" 
      :class="{ 'is-disabled': isAppTransitioning }"
      ref="navRef"
      :aria-disabled="isAppTransitioning"
    >
      <button type="button" data-page-nav :disabled="isAppTransitioning" @click="handleNav('about')" :aria-current="activePage === 'about' ? 'page' : undefined">About</button>
      <button type="button" data-page-nav :disabled="isAppTransitioning" @click="handleNav('experience')" :aria-current="activePage === 'experience' ? 'page' : undefined">Experience</button>
      <button type="button" data-page-nav :disabled="isAppTransitioning" @click="handleNav('projects')" :aria-current="activePage === 'projects' ? 'page' : undefined">Projects</button>
      <button type="button" data-page-nav :disabled="isAppTransitioning" @click="handleNav('contact')" :aria-current="activePage === 'contact' ? 'page' : undefined">Contact</button>
    </div>

    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
.scene-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--surface-color);
  transition: background-color 0.35s ease;
}
canvas {
  display: block;
  z-index: 20;
  position: relative;
}
.ascii-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  overflow: hidden;
  z-index: 10;
}
.dynamic-layout {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 25;
  pointer-events: none;
}

.wechat-badge {
  position: absolute;
  left: 50%;
  bottom: max(124px, env(safe-area-inset-bottom, 0px) + 60px);
  transform: translateX(-50%);
  z-index: 40;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-color);
  font-family: 'Courier New', Courier, monospace;
  font-size: 15px;
  letter-spacing: 0.08em;
  cursor: pointer;
  pointer-events: auto;
}

.wechat-badge img {
  display: block;
  height: 38px;
}

.wechat-badge span {
  white-space: nowrap;
}

.theme-toggle {
  position: absolute;
  left: 38px;
  bottom: max(34px, env(safe-area-inset-bottom, 0px) + 24px);
  z-index: 120;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-color);
  font-family: 'Courier New', Courier, monospace;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  transition: opacity 0.2s ease, color 0.35s ease, border-color 0.2s ease;
}

.theme-toggle:hover {
  opacity: 0.62;
  border-color: var(--text-subtle-color);
}

/* 全局 UI 统一风格：参考主标题颜色 #595959，避免纯黑 #111 过重。 */
.back-btn, .nav-container {
  font-family: 'Courier New', Courier, monospace;
  font-size: 16px;
  color: var(--text-color);
  letter-spacing: 1px;
  user-select: none;
  transition: color 0.35s ease, opacity 0.2s ease;
}

.back-btn {
  position: absolute;
  top: 40px;
  left: 40px;
  z-index: 100;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  white-space: pre;
  transition: opacity 0.2s ease;
}
.back-btn:hover {
  opacity: 0.6;
}

.nav-container {
  position: absolute;
  bottom: 60px;
  display: flex;
  justify-content: space-between;
  z-index: 30;
  pointer-events: auto;
}
.nav-container button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.nav-container button:hover {
  opacity: 0.6;
}
.back-btn:disabled,
.nav-container button:disabled {
  color: inherit;
  cursor: default;
}
.back-btn.is-disabled,
.nav-container.is-disabled {
  pointer-events: none;
}

@media (max-width: 767px) {
  .back-btn,
  .nav-container,
  .dynamic-layout {
    display: none !important;
  }

  .theme-toggle {
    left: 20px;
    bottom: max(22px, env(safe-area-inset-bottom, 0px) + 18px);
  }
}
</style>
