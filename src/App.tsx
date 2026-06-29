import { ReactFlowProvider } from '@xyflow/react'
import { BoardCanvas } from './board/BoardCanvas'
import { BoardExplorer } from './board/BoardExplorer'
import { RightPanel } from './board/RightPanel'

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen bg-slate-50">
        <BoardExplorer />
        <div className="relative min-w-0 flex-1">
          <BoardCanvas />
        </div>
        <RightPanel />
      </div>
    </ReactFlowProvider>
  )
}
