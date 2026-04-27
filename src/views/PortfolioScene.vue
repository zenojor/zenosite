<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SceneRuntime } from '@/scene/SceneRuntime'
import { BREAKPOINTS } from '@/config/breakpoints'
import { getPageFromRoute, PAGE_PATHS, type PageName } from '@/router/pages'
import { activePage, setPage } from '@/state/navigationState'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const asciiRef = ref<HTMLDivElement | null>(null)
const dynamicLayoutRef = ref<HTMLDivElement | null>(null)
const navRef = ref<HTMLDivElement | null>(null)
const backRef = ref<HTMLDivElement | null>(null)
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
    <div 
      class="back-btn" 
      ref="backRef"
      @click="handleNav('home')"
      style="display: none;" 
    >
      [ Back ]
    </div>

    <div class="ascii-overlay" ref="asciiRef"></div>
    <div class="dynamic-layout" ref="dynamicLayoutRef"></div>

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
      />
      <span>{{ wechatCopied ? 'Copied: zenoknowda' : 'zenoknowda' }}</span>
    </button>

    <!-- Nav Container -->
    <div 
      class="nav-container" 
      ref="navRef"
    >
      <span @click="handleNav('about')">About</span>
      <span @click="handleNav('experience')">Experience</span>
      <span @click="handleNav('projects')">Projects</span>
      <span @click="handleNav('contact')">Contact</span>
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
  background-color: #ffffff;
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
  color: #595959;
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

/* 全局 UI 统一风格（参考主标题颜色 #595959，避免纯�?#111 过重�?*/
.back-btn, .nav-container {
  font-family: 'Courier New', Courier, monospace;
  font-size: 16px;
  color: #595959;
  letter-spacing: 1px;
  user-select: none;
}

.back-btn {
  position: absolute;
  top: 40px;
  left: 40px;
  z-index: 100;
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
.nav-container span {
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.nav-container span:hover {
  opacity: 0.6;
}

@media (max-width: 767px) {
  .back-btn,
  .nav-container,
  .dynamic-layout {
    display: none !important;
  }
}
</style>
