import { useState } from 'react'
import { useBoardStore } from '../board/boardStore'
import { runTask } from '../agent/runner'
import { CHECKLIST_TAG_CONFIG } from './tagConfig'
import type { ChecklistItem, ChecklistStatus } from './types'

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

/**
 * Task 체크리스트 항목 한 줄 (v2):
 * - staged: 승인(→committed) / 반려(코멘트→pending→AI 재작업)
 * - pending(비AI·blocking): 완료(→committed) → 대기 중이던 Task 재개
 */
export function ChecklistItemRow({ item }: { item: ChecklistItem }) {
  const setStatus = useBoardStore((s) => s.setChecklistItemStatus)
  const rejectChecklistItem = useBoardStore((s) => s.rejectChecklistItem)

  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')

  const tagCfg = CHECKLIST_TAG_CONFIG[item.tag]
  const lastComment = item.comments.at(-1)

  /** 항목 처리 후 대기 중이던 Task가 있으면 재개 */
  const resumeTask = () => {
    if (!item.taskId) return
    const task = useBoardStore.getState().tasks.find((t) => t.id === item.taskId)
    if (task && task.status === 'waiting') void runTask(task.id)
  }

  const handleComplete = () => {
    if (setStatus(item.id, 'committed')) resumeTask()
  }

  const handleReject = () => {
    if (!comment.trim()) return
    if (rejectChecklistItem(item.id, comment.trim())) {
      setRejecting(false)
      setComment('')
      resumeTask()
    }
  }

  return (
    <li
      className={`rounded border px-2 py-1.5 text-[11px] ${STATUS_CLASS[item.status]}`}
      data-status={item.status}
    >
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 text-slate-400">{STATUS_ICON[item.status]}</span>
        <span
          className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold ${tagCfg.chipClass}`}
        >
          {tagCfg.label}
        </span>
        <span className="min-w-0 flex-1 leading-snug text-slate-700">{item.title}</span>

        <span className="flex shrink-0 gap-1">
          {item.status === 'staged' && (
            <>
              <button
                onClick={handleComplete}
                className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-medium text-white hover:bg-emerald-700"
              >
                승인
              </button>
              <button
                onClick={() => setRejecting((v) => !v)}
                className="rounded bg-red-500 px-1.5 py-px text-[10px] font-medium text-white hover:bg-red-600"
              >
                반려
              </button>
            </>
          )}
          {item.status === 'pending' && item.tag !== 'AI' && (
            <button
              onClick={handleComplete}
              className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-medium text-white hover:bg-emerald-700"
            >
              완료
            </button>
          )}
        </span>
      </div>

      {item.assignee && (
        <p className="mt-0.5 text-[9px] text-slate-400">담당: {item.assignee}</p>
      )}

      {lastComment && item.status === 'pending' && (
        <p className="mt-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-500">
          {item.tag === 'blocking' ? '사유' : '반려 코멘트'}: {lastComment.text}
        </p>
      )}

      {rejecting && (
        <div className="mt-1.5 space-y-1">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="반려 사유를 입력하세요 — AI 재작업에 반영됩니다"
            rows={2}
            className="w-full resize-none rounded border border-red-200 px-1.5 py-1 text-[11px] focus:border-red-400 focus:outline-none"
          />
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setRejecting(false)}
              className="rounded px-1.5 py-px text-[10px] text-slate-500 hover:bg-slate-100"
            >
              취소
            </button>
            <button
              onClick={handleReject}
              disabled={!comment.trim()}
              className="rounded bg-red-500 px-1.5 py-px text-[10px] font-medium text-white hover:bg-red-600 disabled:bg-slate-300"
            >
              반려 확정
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
