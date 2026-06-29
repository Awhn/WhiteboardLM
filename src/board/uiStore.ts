import { create } from 'zustand'

export type DrawerTab = 'checklist' | 'log'

interface UIState {
  drawerOpen: boolean
  drawerTab: DrawerTab
  openDrawer: (tab: DrawerTab) => void
  closeDrawer: () => void
  /** 같은 탭으로 다시 누르면 닫고, 다른 탭이면 전환 */
  toggleDrawer: (tab: DrawerTab) => void
  /** 좌측 탐색기(파일트리) 표시 여부 */
  explorerOpen: boolean
  toggleExplorer: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  drawerOpen: false,
  drawerTab: 'checklist',
  openDrawer: (tab) => set({ drawerOpen: true, drawerTab: tab }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleDrawer: (tab) => {
    const { drawerOpen, drawerTab } = get()
    if (drawerOpen && drawerTab === tab) set({ drawerOpen: false })
    else set({ drawerOpen: true, drawerTab: tab })
  },
  explorerOpen: true,
  toggleExplorer: () => set((s) => ({ explorerOpen: !s.explorerOpen })),
}))
