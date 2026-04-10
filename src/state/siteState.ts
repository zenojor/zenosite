import { ref, type Ref } from 'vue'

export type PageName = 'home' | 'about' | 'experience' | 'projects' | 'contact'

/** 当前激活的页面 */
export const activePage: Ref<PageName> = ref('home')

/** 页面是否正在过渡中 */
export const isAppTransitioning: Ref<boolean> = ref(false)

/** 切换页面 */
export function setPage(page: PageName, force: boolean = false) {
  if (isAppTransitioning.value && !force) return
  activePage.value = page
}
