import { ref, type Ref } from 'vue'
import type { PageName } from '@/router/pages'

/** Current active page. */
export const activePage: Ref<PageName> = ref('home')

/** Whether a page transition is currently running. */
export const isAppTransitioning: Ref<boolean> = ref(false)

/** Switch the active page. */
export function setPage(page: PageName, _force: boolean = false) {
  activePage.value = page
}
