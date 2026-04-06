import { ref, type Ref } from 'vue'

export type PageName = 'home' | 'about' | 'experience' | 'projects' | 'contact'

/** 当前激活的页面 */
export const activePage: Ref<PageName> = ref('home')

/** 切换页面 */
export function setPage(page: PageName) {
  activePage.value = page
}
