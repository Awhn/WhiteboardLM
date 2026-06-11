import { create } from 'zustand'

export type DrawerTab = 'checklist' | 'log'

interface UIState {
  drawerOpen: boolean
  drawerTab: DrawerTab
  openDrawer: (tab: DrawerTab) => void
  closeDrawer: () => void
  /** 같은 탭으로 다시 누르면 닫고, 다른 탭이면 전환 */
  toggleDrawer: (tab: DrawerTab) => void
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
}))
