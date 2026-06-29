import { create } from 'zustand'

/** 우측 통합 패널의 세로탭 */
export type RightTab = 'inspector' | 'checklist' | 'log' | 'settings'

interface UIState {
  /** 좌측 탐색기(파일트리) 표시 여부 */
  explorerOpen: boolean
  toggleExplorer: () => void

  /** 우측 통합 패널 */
  rightTab: RightTab
  rightCollapsed: boolean
  setRightTab: (tab: RightTab) => void
  toggleRightCollapsed: () => void
}

export const useUIStore = create<UIState>((set) => ({
  explorerOpen: true,
  toggleExplorer: () => set((s) => ({ explorerOpen: !s.explorerOpen })),

  rightTab: 'inspector',
  rightCollapsed: false,
  setRightTab: (tab) => set({ rightTab: tab, rightCollapsed: false }),
  toggleRightCollapsed: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
}))
