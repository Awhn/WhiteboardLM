import { ReactFlowProvider } from '@xyflow/react'
import { BoardCanvas } from './board/BoardCanvas'
import { BoardExplorer } from './board/BoardExplorer'
import { BottomDrawer } from './board/BottomDrawer'
import { WorkspaceSidebar } from './workspace/WorkspaceSidebar'

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col bg-slate-50">
        <div className="relative flex min-h-0 flex-1">
          <BoardExplorer />
          <div className="relative min-w-0 flex-1">
            <BoardCanvas />
          </div>
          <WorkspaceSidebar />
        </div>
        <BottomDrawer />
      </div>
    </ReactFlowProvider>
  )
}
