import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import PortfolioScene from '@/views/PortfolioScene.vue'
import { PAGE_NAMES, PAGE_PATHS } from '@/router/pages'

const routes: RouteRecordRaw[] = PAGE_NAMES.map((page) => ({
  path: PAGE_PATHS[page],
  name: page,
  component: PortfolioScene,
  meta: { page },
}))

routes.push({
  path: '/:pathMatch(.*)*',
  redirect: PAGE_PATHS.home,
})

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
