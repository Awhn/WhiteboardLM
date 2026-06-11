import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoardStore } from '../board/boardStore'
import { getLLMClient } from '../llm'
import { isDeclarationComplete } from '../workspace/declaration'
import type { Workspace } from '../workspace/types'
import { ChecklistItemRow } from './ChecklistItemRow'
import { parseChecklistLines } from './parse'
import type { ChecklistTag } from './types'

/** 우측 사이드바의 작업공간별 체크리스트 섹션 (생성·목록·수동 추가) */
export function WorkspaceChecklist({ workspace }: { workspace: Workspace }) {
  const items = useBoardStore(
    useShallow((s) => s.checklistItems.filter((i) => i.workspaceId === workspace.id)),
  )
  const setChecklistForWorkspace = useBoardStore((s) => s.setChecklistForWorkspace)
  const addChecklistItem = useBoardStore((s) => s.addChecklistItem)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newTag, setNewTag] = useState<ChecklistTag>('AI')

  const complete = isDeclarationComplete(workspace)
  const committedCount = items.filter((i) => i.status === 'committed').length

  const handleGenerate = async () => {
    const id = workspace.id
    setGenerating(true)
    setError(null)
    try {
      const lines = await getLLMClient().generateChecklist({
        name: workspace.name,
        type: workspace.type,
        purpose: workspace.declaration.purpose,
        dynamicFields: workspace.declaration.dynamicFields,
      })
      const parsed = parseChecklistLines(lines)
      if (parsed.length === 0) throw new Error('생성된 체크리스트가 비어 있습니다.')
      setChecklistForWorkspace(id, parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : '체크리스트 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const handleAdd = () => {
    if (!newTitle.trim()) return
    addChecklistItem(workspace.id, newTitle.trim(), newTag)
    setNewTitle('')
  }

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">체크리스트</span>
        {items.length > 0 && (
          <span className="text-[10px] text-slate-400">
            {committedCount}/{items.length} committed
          </span>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={!complete || generating}
        title={complete ? '' : '정의를 완료하면 생성할 수 있습니다'}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {generating
          ? '체크리스트 생성 중…'
          : items.length > 0
            ? '🔄 체크리스트 다시 생성'
            : '📋 체크리스트 생성'}
      </button>
      {!complete && (
        <p className="mt-1 text-[10px] text-slate-400">
          목적과 모든 동적 필드를 입력하면 활성화됩니다.
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <p>{error}</p>
          <button onClick={handleGenerate} className="mt-1 font-semibold underline">
            다시 시도
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <ul className="mt-2 space-y-1">
            {items.map((item) => (
              <ChecklistItemRow key={item.id} item={item} />
            ))}
          </ul>

          <div className="mt-1.5 flex gap-1">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="항목 직접 추가"
              className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] focus:border-blue-400 focus:outline-none"
            />
            <select
              value={newTag}
              onChange={(e) => setNewTag(e.target.value as ChecklistTag)}
              className="rounded border border-slate-200 px-0.5 text-[10px]"
              aria-label="항목 태그"
            >
              <option value="AI">AI</option>
              <option value="human">인간</option>
              <option value="approval">승인</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="rounded bg-slate-700 px-2 text-[10px] font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              +
            </button>
          </div>
        </>
      )}
    </div>
  )
}
