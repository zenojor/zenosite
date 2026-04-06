<script setup lang="ts">
import ThreeScene from './components/ThreeScene.vue'
</script>

<template>
  <ThreeScene />
</template>

<style>
/* Global resets for full-screen Three.js canvas */
body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  max-width: none;
}
</style>
