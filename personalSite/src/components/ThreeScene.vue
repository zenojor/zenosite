<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Experience } from '../three/Experience'
import { activePage, setPage, type PageName } from '../state/siteState'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const asciiRef = ref<HTMLDivElement | null>(null)
const dynamicLayoutRef = ref<HTMLDivElement | null>(null)
const navRef = ref<HTMLDivElement | null>(null)
const backRef = ref<HTMLDivElement | null>(null)

let experience: Experience | null = null

const handleNav = (page: PageName) => {
  if (activePage.value === page && page !== 'home') {
    setPage('home')
  } else {
    setPage(page)
  }
}

onMounted(() => {
  if (!canvasRef.value || !asciiRef.value || !dynamicLayoutRef.value) return

  experience = new Experience({
    canvas: canvasRef.value,
    asciiContainer: asciiRef.value,
    dynamicLayoutContainer: dynamicLayoutRef.value,
    navContainer: navRef.value,
    backButton: backRef.value,
  })
})

onBeforeUnmount(() => {
  experience?.dispose()
  experience = null
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

/* 全局 UI 统一风格（参考主标题颜色 #595959，避免纯黑 #111 过重） */
.back-btn, .nav-container {
  font-family: 'Courier New', 'DinkieBitmap 9px', Courier, monospace;
  font-size: 16px;
  color: #595959;
  font-weight: bold;
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
</style>
