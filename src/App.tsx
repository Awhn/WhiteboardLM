import { ReactFlowProvider } from '@xyflow/react'
import { BoardCanvas } from './board/BoardCanvas'

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen bg-slate-50">
        <BoardCanvas />
      </div>
    </ReactFlowProvider>
  )
}
