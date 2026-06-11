import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoardStore } from '../board/boardStore'
import { CHECKLIST_TAG_CONFIG } from './tagConfig'
import type { ChecklistStatus, ChecklistTag } from './types'

const STATUS_CLASS: Record<ChecklistStatus, string> = {
  pending: 'border-slate-200 bg-white',
  staged: 'border-amber-300 bg-amber-50',
  committed: 'border-emerald-300 bg-emerald-50',
}

const STATUS_ICON: Record<ChecklistStatus, string> = {
  pending: '○',
  staged: '◐',
  committed: '●',
}

/** 작업공간 노드 내부에 표시되는 체크리스트 (M5) */
export function ChecklistSection({ workspaceId }: { workspaceId: string }) {
  const items = useBoardStore(
    useShallow((s) => s.checklistItems.filter((i) => i.workspaceId === workspaceId)),
  )
  const addChecklistItem = useBoardStore((s) => s.addChecklistItem)

  const [newTitle, setNewTitle] = useState('')
  const [newTag, setNewTag] = useState<ChecklistTag>('AI')

  const handleAdd = () => {
    if (!newTitle.trim()) return
    addChecklistItem(workspaceId, newTitle.trim(), newTag)
    setNewTitle('')
  }

  if (items.length === 0) return null

  return (
    <div className="border-t border-slate-100 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          체크리스트
        </span>
        <span className="text-[10px] text-slate-400">
          {items.filter((i) => i.status === 'committed').length}/{items.length} committed
        </span>
      </div>

      <ul className="space-y-1">
        {items.map((item) => {
          const tagCfg = CHECKLIST_TAG_CONFIG[item.tag]
          return (
            <li
              key={item.id}
              className={`flex items-start gap-1.5 rounded border px-2 py-1 text-[11px] ${STATUS_CLASS[item.status]}`}
              data-status={item.status}
            >
              <span className="shrink-0 text-slate-400">{STATUS_ICON[item.status]}</span>
              <span
                className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold ${tagCfg.chipClass}`}
              >
                {tagCfg.label}
              </span>
              <span className="min-w-0 flex-1 leading-snug text-slate-700">{item.title}</span>
            </li>
          )
        })}
      </ul>

      <div className="nodrag mt-1.5 flex gap-1">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="항목 직접 추가"
          className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] focus:border-blue-400 focus:outline-none"
        />
        <select
          value={newTag}
          onChange={(e) => setNewTag(e.target.value as ChecklistTag)}
          className="rounded border border-slate-200 px-0.5 py-0.5 text-[10px]"
          aria-label="항목 태그"
        >
          <option value="AI">AI</option>
          <option value="human">인간</option>
          <option value="approval">승인</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          className="rounded bg-slate-700 px-1.5 text-[10px] font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          +
        </button>
      </div>
    </div>
  )
}
